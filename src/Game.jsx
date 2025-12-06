import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

const Game = () => {
    const sceneRef = useRef(null);
    const engineRef = useRef(null);
    const renderRef = useRef(null);
    const runnerRef = useRef(null);
    const [distance, setDistance] = useState(0);
    const [isStopped, setIsStopped] = useState(false);

    useEffect(() => {
        // Module aliases
        const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            Bodies = Matter.Bodies,
            Composite = Matter.Composite,
            Mouse = Matter.Mouse,
            MouseConstraint = Matter.MouseConstraint,
            Events = Matter.Events,
            Vector = Matter.Vector;

        // Create engine
        const engine = Engine.create();
        engineRef.current = engine;

        // Create renderer
        const render = Render.create({
            element: sceneRef.current,
            engine: engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                wireframes: false,
                background: '#87CEEB', // Sky blue
                hasBounds: true,
            },
        });
        renderRef.current = render;

        // Create bodies
        // Ground needs to be very long
        const ground = Bodies.rectangle(0, window.innerHeight - 20, 1000000, 40, {
            isStatic: true,
            render: { fillStyle: '#4CAF50' }, // Grass green
            label: 'ground',
        });
        // Set ground position to start at 0 and extend right
        Matter.Body.setPosition(ground, { x: 500000, y: window.innerHeight - 20 });

        const startX = 200;
        const startY = window.innerHeight - 100;
        const ball = Bodies.circle(startX, startY, 20, {
            restitution: 0.8,
            frictionAir: 0.002, // Reduced from 0.01 for smoother flight
            friction: 0.05, // Ground friction
            render: { fillStyle: '#FFFFFF' }, // White ball
            label: 'ball',
        });

        // Generate Trees
        const trees = [];
        for (let i = 0; i < 2000; i++) {
            const x = 500 + i * 800 + Math.random() * 200; // Every ~800px
            const trunkHeight = 60 + Math.random() * 40;
            const trunkWidth = 20;
            const foliageRadius = 40 + Math.random() * 20;

            const trunk = Bodies.rectangle(x, window.innerHeight - 40 - trunkHeight / 2, trunkWidth, trunkHeight, {
                isStatic: true,
                isSensor: true, // Don't collide
                render: { fillStyle: '#8B4513' } // Brown
            });

            const foliage = Bodies.circle(x, window.innerHeight - 40 - trunkHeight - foliageRadius / 2 + 10, foliageRadius, {
                isStatic: true,
                isSensor: true,
                render: { fillStyle: '#228B22' } // Forest Green
            });

            trees.push(trunk, foliage);
        }

        // Add bodies to world
        Composite.add(engine.world, [ground, ball, ...trees]);

        // Add mouse control
        const mouse = Mouse.create(render.canvas);
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.05, // Reduced stiffness
                render: {
                    visible: false,
                },
            },
        });
        Composite.add(engine.world, mouseConstraint);

        // Keep the mouse in sync with rendering
        render.mouse = mouse;

        // Game loop logic
        let isThrown = false;
        let stopCounter = 0;
        let isDragging = false;

        Events.on(mouseConstraint, 'startdrag', () => {
            // Prevent re-grabbing if already thrown
            if (isThrown) {
                // Force release immediately if we try to grab after throw
            }
            isDragging = true;
        });

        Events.on(mouseConstraint, 'enddrag', () => {
            isDragging = false;
            // Check for throw on release
            if (!isThrown && (ball.velocity.x > 2 || ball.velocity.y < -2)) {
                isThrown = true;
                // Disable future interactions
                mouseConstraint.collisionFilter.mask = 0; // Disable collision with everything
            }
        });

        Events.on(engine, 'beforeUpdate', () => {
            // Update distance
            // Only update distance if NOT dragging
            if (!isDragging) {
                const currentDist = Math.max(0, Math.floor((ball.position.x - startX) / 10));
                setDistance(currentDist);
            }

            // Camera Follow Logic
            // Only follow if NOT dragging and NOT stopped
            if (!isStopped && !isDragging) {
                // Center camera on ball X
                const viewportWidth = render.bounds.max.x - render.bounds.min.x;

                // Target center
                const targetX = ball.position.x;

                // Smoothly interpolate camera position
                const currentCenterX = render.bounds.min.x + viewportWidth / 2;

                const newCenterX = currentCenterX + (targetX - currentCenterX) * 0.1;

                // Update bounds
                render.bounds.min.x = newCenterX - viewportWidth / 2;
                render.bounds.max.x = newCenterX + viewportWidth / 2;

                // Ensure we don't see behind the start
                if (render.bounds.min.x < -100) {
                    const diff = -100 - render.bounds.min.x;
                    render.bounds.min.x += diff;
                    render.bounds.max.x += diff;
                }

                // Mouse interaction update for camera offset
                Mouse.setOffset(mouse, render.bounds.min);
            }

            // Check for stop
            // Only check if explicitly thrown
            if (isThrown) {
                const speed = Vector.magnitude(ball.velocity);
                // Relaxed stop condition: speed < 0.5 and on ground
                if (speed < 0.5 && ball.position.y > window.innerHeight - 100) {
                    stopCounter++;
                } else {
                    stopCounter = 0;
                }

                if (stopCounter > 60) { // ~1 second of stillness
                    setIsStopped(true);
                    // isThrown remains true to prevent re-grab

                    // Zoom out logic
                    const padding = 100;
                    const minX = Math.min(startX, ball.position.x) - padding;
                    const maxX = Math.max(startX, ball.position.x) + padding;
                    const width = maxX - minX;
                    const height = width * (window.innerHeight / window.innerWidth); // Maintain aspect ratio

                    render.bounds.min.x = minX;
                    render.bounds.max.x = maxX;
                    render.bounds.min.y = window.innerHeight - height; // Anchor to bottom
                    render.bounds.max.y = window.innerHeight;

                    Mouse.setOffset(mouse, render.bounds.min);
                }
            }
        });

        // Run the renderer
        Render.run(render);

        // Create runner
        const runner = Runner.create();
        runnerRef.current = runner;
        Runner.run(runner, engine);

        // Cleanup
        return () => {
            Render.stop(render);
            Runner.stop(runner);
            if (render.canvas) {
                render.canvas.remove();
            }
            Composite.clear(engine.world);
            Engine.clear(engine);
        };
    }, []); // Empty dependency array, run once

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div
                ref={sceneRef}
                style={{
                    width: '100%',
                    height: '100%',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
            >
                飛距離: {distance} m
            </div>
            {isStopped && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        fontSize: '48px',
                        fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        textAlign: 'center',
                    }}
                >
                    <div>記録終了</div>
                    <div>最終飛距離: {distance} m</div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            fontSize: '20px',
                            cursor: 'pointer'
                        }}
                    >
                        もう一度遊ぶ
                    </button>
                </div>
            )}
        </div>
    );
};

export default Game;
