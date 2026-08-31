<?php

declare(strict_types=1);

namespace Iced\Kernel;

use ReflectionClass;
use ReflectionNamedType;
use RuntimeException;

/**
 * Small constructor-injection container. Explicit bindings win; anything else
 * is autowired from type hints, which keeps controllers/services/repositories
 * free of registration boilerplate.
 */
final class Container
{
    /** @var array<string, callable(Container): mixed> */
    private array $factories = [];

    /** @var array<string, mixed> */
    private array $instances = [];

    /** @var array<string, bool> */
    private array $shared = [];

    /** @param callable(Container): mixed $factory */
    public function bind(string $id, callable $factory): void
    {
        $this->factories[$id] = $factory;
        $this->shared[$id] = false;
        unset($this->instances[$id]);
    }

    /** @param callable(Container): mixed $factory */
    public function singleton(string $id, callable $factory): void
    {
        $this->factories[$id] = $factory;
        $this->shared[$id] = true;
        unset($this->instances[$id]);
    }

    public function instance(string $id, mixed $value): void
    {
        $this->instances[$id] = $value;
        $this->shared[$id] = true;
    }

    public function has(string $id): bool
    {
        return isset($this->factories[$id]) || array_key_exists($id, $this->instances);
    }

    public function get(string $id): mixed
    {
        if (array_key_exists($id, $this->instances)) {
            return $this->instances[$id];
        }

        if (isset($this->factories[$id])) {
            $value = ($this->factories[$id])($this);

            if ($this->shared[$id] ?? false) {
                $this->instances[$id] = $value;
            }

            return $value;
        }

        return $this->make($id);
    }

    /**
     * @template T of object
     *
     * @param class-string<T>|string $class
     *
     * @return T|object
     */
    public function make(string $class): object
    {
        if (array_key_exists($class, $this->instances) && is_object($this->instances[$class])) {
            /** @var T $shared */
            $shared = $this->instances[$class];

            return $shared;
        }

        if (isset($this->factories[$class])) {
            $built = $this->get($class);

            if (!is_object($built)) {
                throw new RuntimeException(sprintf('Binding "%s" did not produce an object.', $class));
            }

            return $built;
        }

        if (!class_exists($class)) {
            throw new RuntimeException(sprintf('Cannot resolve "%s" — class not found.', $class));
        }

        $reflection = new ReflectionClass($class);
        $constructor = $reflection->getConstructor();

        if ($constructor === null) {
            $instance = $reflection->newInstance();
            $this->instances[$class] = $instance;

            return $instance;
        }

        $arguments = [];

        foreach ($constructor->getParameters() as $parameter) {
            $type = $parameter->getType();

            if ($type instanceof ReflectionNamedType && !$type->isBuiltin()) {
                $arguments[] = $this->get($type->getName());

                continue;
            }

            if ($parameter->isDefaultValueAvailable()) {
                $arguments[] = $parameter->getDefaultValue();

                continue;
            }

            throw new RuntimeException(sprintf(
                'Cannot autowire $%s of %s — add an explicit binding.',
                $parameter->getName(),
                $class,
            ));
        }

        $instance = $reflection->newInstanceArgs($arguments);
        $this->instances[$class] = $instance;

        return $instance;
    }
}
