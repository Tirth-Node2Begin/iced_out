<?php

declare(strict_types=1);

/**
 * Idempotency that survives CONCURRENCY, not just repetition.
 *
 *   php tests/Smoke/idempotency-smoke.php
 *
 * ── THE RACE THIS PINS ──────────────────────────────────────────────────────
 *
 * The middleware read the table, ran the handler, then inserted. Two requests
 * carrying the same Idempotency-Key and arriving TOGETHER both missed the read,
 * both ran the handler, and both inserted — the unique index quietly collapsing
 * the second row while two orders had already been placed.
 *
 * The double-tap it exists to prevent is exactly the case that produces two
 * requests milliseconds apart rather than seconds, so the window was not
 * theoretical. It is closed by claiming the row BEFORE the handler runs and
 * letting the unique index arbitrate.
 *
 * The concurrent case is simulated by planting the IN_FLIGHT row a competing
 * request would have left, which is deterministic where racing two real requests
 * inside one PHP process is not.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application; use Iced\Kernel\Database; use Iced\Kernel\Request;
use Iced\Service\Auth\SessionManager;

$app = Application::boot($root);
$db  = $app->container->make(Database::class);
$sessions = $app->container->make(SessionManager::class);
$pass=0; $fail=0;
function ok(string $l, bool $c, string $d=''){ global $pass,$fail; $c?$pass++:$fail++;
  printf("  %s %-50s %s\n", $c?"\033[32mPASS\033[0m":"\033[31mFAIL\033[0m", $l, $d); }

try {
$db->transaction(function (Database $db) use ($app,$sessions) {
  $db->statement('UPDATE variant_inventory SET stock_item_id = NULL, on_hand = on_hand + 100');
  $u = $db->selectOne("SELECT * FROM users WHERE type='CUSTOMER' AND status='ACTIVE' ORDER BY id LIMIT 1");
  $v = $db->selectOne("SELECT p.public_id slug, v.size FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.deleted_at IS NULL AND p.price>0 ORDER BY v.id LIMIT 1");

  $probe = new Request('GET','/',[],[],[],'','127.0.0.1');
  $issued = $sessions->issue((int)$u['id'], 'customer', $probe);
  $cookie = $issued['token'];

  $body = json_encode([
    'lines'=>[['productId'=>$v['slug'],'size'=>$v['size'],'quantity'=>1]],
    'contact'=>['name'=>'Test Shopper','email'=>'t@example.com','mobile'=>'9876543210'],
    'address'=>['line'=>'14 Carter Road, Bandra','city'=>'Mumbai','state'=>'Maharashtra','postalCode'=>'400050'],
    'delivery'=>['id'=>'standard','label'=>'Standard delivery','estimate'=>'3-5'],
    'payment'=>['outcome'=>'due','method'=>'Cash on delivery'],
    'money'=>['walletApplied'=>0,'couponCode'=>null],
  ]);

  $call = function(string $body, string $key) use ($app,$cookie) {
    $r = new Request('POST','/checkout/orders',[], [
      'x-client-audience'=>'customer','content-type'=>'application/json',
      'idempotency-key'=>$key,'origin'=>'http://127.0.0.1:8000',
    ], ['io_csess'=>$cookie], $body, '127.0.0.1');
    $res = $app->handle($r);
    return [$res->status(), $res->headers(), $res->body()];
  };

  $key = 'idem-'.bin2hex(random_bytes(6));

  [$s1,$h1,$b1] = $call($body, $key);
  ok('first call places the order', $s1 === 201, "HTTP $s1");
  $orders1 = (int)$db->selectOne('SELECT COUNT(*) c FROM orders')['c'];

  [$s2,$h2,$b2] = $call($body, $key);
  $orders2 = (int)$db->selectOne('SELECT COUNT(*) c FROM orders')['c'];
  ok('same key + same body replays', $s2 === 201 && isset($h2['Idempotent-Replay']), "HTTP $s2");
  ok('...and places no second order', $orders1 === $orders2, "$orders1 -> $orders2");
  ok('...byte-for-byte the same envelope', json_decode($b1,true)['data'] == json_decode($b2,true)['data']);

  $other = str_replace('"quantity":1','"quantity":2',$body);
  [$s3,,$b3] = $call($other, $key);
  ok('same key + different body is 409', $s3 === 409 && str_contains($b3,'ICE-IDMP-409'), "HTTP $s3");

  // Concurrency: a claim already held IN_FLIGHT by another request.
  $key2 = 'idem-'.bin2hex(random_bytes(6));
  $db->statement(
    'INSERT INTO idempotency_keys (scope,endpoint,key_hash,request_hash,status,response_status,response_body,expires_at,created_at)
     VALUES (?,?,?,?,?,0,NULL,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),UTC_TIMESTAMP(6))',
    ['customer:'.$u['public_id'],'POST /checkout/orders',hash('sha256',$key2,true),hash('sha256',$body,true),'IN_FLIGHT']);
  $before = (int)$db->selectOne('SELECT COUNT(*) c FROM orders')['c'];
  [$s4,,$b4] = $call($body, $key2);
  $after = (int)$db->selectOne('SELECT COUNT(*) c FROM orders')['c'];
  ok('a concurrent duplicate is refused 409', $s4 === 409, "HTTP $s4");
  ok('...retryable, so the client waits', str_contains($b4,'"retryable":true'));
  ok('...and does NOT place a second order  [THE RACE]', $before === $after, "$before -> $after");

  // A failing request must hand the key back.
  $key3 = 'idem-'.bin2hex(random_bytes(6));
  $bad = str_replace('"quantity":1','"quantity":0',$body);   // "There is nothing in the bag."
  [$s5,,] = $call($bad, $key3);
  $held = $db->selectOne('SELECT status FROM idempotency_keys WHERE key_hash = ?', [hash('sha256',$key3,true)]);
  ok('a failed request is not stored', $s5 >= 400 && $held === null, "HTTP $s5, row=".($held===null?'released':$held['status']));

  [$s6,,] = $call($body, $key3);
  ok('...so the same key can be retried', $s6 === 201, "HTTP $s6");

  throw new RuntimeException('__rollback__');
});
} catch (RuntimeException $e) { if ($e->getMessage()!=='__rollback__') throw $e; }
printf("\n  %d passed, %d failed\n\n", $pass, $fail);
