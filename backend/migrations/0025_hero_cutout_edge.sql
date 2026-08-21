-- How much of a cutout's border came back transparent.
--
-- remove.bg returning 200 does not mean the picture is usable HERE. Feed it a
-- flat-lay — a garment cropped edge to edge, which is what most catalogue
-- photography actually is — and it succeeds: it trims a little around the
-- outside and hands back an image that is still, essentially, a rectangle. The
-- hero then draws that rectangle floating in the middle of the home page with
-- four hard corners on it, which reads as a broken build rather than as a
-- design.
--
-- Overall transparency does not catch this. Measured across three real cutouts,
-- a proper isolated shot came back 76% transparent and two flat-lays came back
-- 23% and 17% — close enough together that any threshold would be a coin toss.
--
-- The BORDER does catch it, and cleanly: the same three measured 100%, 49% and
-- 34% transparent around the outermost ring. A garment that floats has nothing
-- touching the frame; a garment that fills the frame cannot float, whatever the
-- middle of the picture looks like.
--
-- Stored as a percentage rather than as a verdict so the threshold can move
-- without a migration and without re-cutting anything. 100 for rows cut before
-- this existed: unmeasured, and claiming they are suspect would put a warning
-- on garments nobody has looked at.

ALTER TABLE home_hero_slides
    ADD COLUMN cutout_edge_clear TINYINT UNSIGNED NOT NULL DEFAULT 100 AFTER cutout_detail;
