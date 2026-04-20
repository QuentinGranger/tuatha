"use client";

import Link from "next/link";
import { useRef, useEffect, useState, useCallback } from "react";
import styles from "./not-found.module.scss";

/* ────── Constants ────── */
const TILE = 24;
const COLS = 21;
const ROWS = 21;
const SPEED = 180;
const GHOST_SPEED = 220;

// 0=wall, 1=dot, 2=power, 3=empty, 4=ghost-house
const MAZE: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0],
  [0,2,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,2,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,1,0],
  [0,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0],
  [3,3,3,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,3,3,3],
  [0,0,0,0,1,0,1,0,0,4,4,4,0,0,1,0,1,0,0,0,0],
  [1,1,1,1,1,1,1,0,4,4,4,4,4,0,1,1,1,1,1,1,1],
  [0,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0],
  [3,3,3,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,3,3,3],
  [0,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,0],
  [0,2,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,2,0],
  [0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,0],
  [0,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

type Dir = { x: number; y: number };
const DIR_UP: Dir = { x: 0, y: -1 };
const DIR_DOWN: Dir = { x: 0, y: 1 };
const DIR_LEFT: Dir = { x: -1, y: 0 };
const DIR_RIGHT: Dir = { x: 1, y: 0 };
const DIRS = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT];

const GHOST_COLORS = ["#ef5350", "#ff6b9d", "#00bcd4", "#ffb74d"];

function cloneMaze() {
  return MAZE.map((r) => [...r]);
}

function canMove(maze: number[][], x: number, y: number): boolean {
  const wx = ((x % COLS) + COLS) % COLS;
  const wy = ((y % ROWS) + ROWS) % ROWS;
  const t = maze[wy]?.[wx];
  return t !== undefined && t !== 0;
}

/* ────── Component ────── */
export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "won" | "dead">("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const gameRef = useRef<{
    maze: number[][];
    pacman: { x: number; y: number; dir: Dir; nextDir: Dir; mouthAngle: number; mouthOpen: boolean };
    ghosts: { x: number; y: number; dir: Dir; color: string; scared: boolean; scaredTimer: number }[];
    score: number;
    lives: number;
    dots: number;
    running: boolean;
    lastMove: number;
    lastGhostMove: number;
    animFrame: number;
  } | null>(null);

  const touchRef = useRef<{ x: number; y: number } | null>(null);

  // Fetch user session to determine dashboard path
  const [homePath, setHomePath] = useState("/");
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.specialite) setHomePath(`/dashboard/${data.specialite}`);
      })
      .catch(() => {});
  }, []);

  const initGame = useCallback(() => {
    const maze = cloneMaze();
    let dots = 0;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (maze[y][x] === 1 || maze[y][x] === 2) dots++;

    const g = {
      maze,
      pacman: { x: 10, y: 15, dir: DIR_LEFT, nextDir: DIR_LEFT, mouthAngle: 0.25, mouthOpen: true },
      ghosts: [
        { x: 9, y: 9, dir: DIR_UP, color: GHOST_COLORS[0], scared: false, scaredTimer: 0 },
        { x: 10, y: 9, dir: DIR_UP, color: GHOST_COLORS[1], scared: false, scaredTimer: 0 },
        { x: 11, y: 9, dir: DIR_UP, color: GHOST_COLORS[2], scared: false, scaredTimer: 0 },
        { x: 10, y: 10, dir: DIR_DOWN, color: GHOST_COLORS[3], scared: false, scaredTimer: 0 },
      ],
      score: 0,
      lives: 3,
      dots,
      running: true,
      lastMove: 0,
      lastGhostMove: 0,
      animFrame: 0,
    };
    gameRef.current = g;
    setScore(0);
    setLives(3);
    setGameState("playing");
  }, []);

  /* ── Drawing (3D modern) ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    if (!canvas || !g) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Background
    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, W, H);

    // Subtle floor grid
    ctx.strokeStyle = "rgba(57, 73, 171, 0.06)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(W, y * TILE); ctx.stroke();
    }

    // Draw maze
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = g.maze[y][x];
        const tx = x * TILE;
        const ty = y * TILE;

        if (t === 0) {
          // 3D wall: top face
          const wallGrad = ctx.createLinearGradient(tx, ty, tx, ty + TILE);
          wallGrad.addColorStop(0, "#283593");
          wallGrad.addColorStop(1, "#1a237e");
          ctx.fillStyle = wallGrad;
          const r = 3;
          ctx.beginPath();
          ctx.moveTo(tx + r + 1, ty + 1);
          ctx.lineTo(tx + TILE - r - 1, ty + 1);
          ctx.quadraticCurveTo(tx + TILE - 1, ty + 1, tx + TILE - 1, ty + r + 1);
          ctx.lineTo(tx + TILE - 1, ty + TILE - r - 1);
          ctx.quadraticCurveTo(tx + TILE - 1, ty + TILE - 1, tx + TILE - r - 1, ty + TILE - 1);
          ctx.lineTo(tx + r + 1, ty + TILE - 1);
          ctx.quadraticCurveTo(tx + 1, ty + TILE - 1, tx + 1, ty + TILE - r - 1);
          ctx.lineTo(tx + 1, ty + r + 1);
          ctx.quadraticCurveTo(tx + 1, ty + 1, tx + r + 1, ty + 1);
          ctx.closePath();
          ctx.fill();

          // Highlight edge (top-left light)
          ctx.strokeStyle = "rgba(92, 107, 192, 0.4)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(tx + r + 1, ty + 1.5);
          ctx.lineTo(tx + TILE - r - 1, ty + 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(tx + 1.5, ty + r + 1);
          ctx.lineTo(tx + 1.5, ty + TILE - r - 1);
          ctx.stroke();

          // Shadow edge (bottom-right)
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.beginPath();
          ctx.moveTo(tx + r + 1, ty + TILE - 1.5);
          ctx.lineTo(tx + TILE - r - 1, ty + TILE - 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(tx + TILE - 1.5, ty + r + 1);
          ctx.lineTo(tx + TILE - 1.5, ty + TILE - r - 1);
          ctx.stroke();

        } else if (t === 1) {
          // Glowing dot
          const cx = tx + TILE / 2;
          const cy = ty + TILE / 2;
          ctx.shadowColor = "#ffeb3b";
          ctx.shadowBlur = 6;
          const dotGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3);
          dotGrad.addColorStop(0, "#fff9c4");
          dotGrad.addColorStop(1, "#ffeb3b");
          ctx.fillStyle = dotGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

        } else if (t === 2) {
          // Pulsing power pellet with glow
          const cx = tx + TILE / 2;
          const cy = ty + TILE / 2;
          const pulse = 5 + Math.sin(Date.now() / 200) * 1.5;
          ctx.shadowColor = "#ffeb3b";
          ctx.shadowBlur = 14;
          const pelletGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, pulse);
          pelletGrad.addColorStop(0, "#ffffff");
          pelletGrad.addColorStop(0.4, "#fff9c4");
          pelletGrad.addColorStop(1, "#f9a825");
          ctx.fillStyle = pelletGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw Pac-Man
    const p = g.pacman;
    const px = p.x * TILE + TILE / 2;
    const py = p.y * TILE + TILE / 2;
    const angle = Math.atan2(p.dir.y, p.dir.x);
    const mouth = p.mouthAngle * Math.PI;
    const pr = TILE / 2 - 1;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(px + 2, py + 3, pr, pr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowColor = "#ffeb3b";
    ctx.shadowBlur = 12;

    // Body gradient
    const pacGrad = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, pr);
    pacGrad.addColorStop(0, "#fff9c4");
    pacGrad.addColorStop(0.5, "#ffeb3b");
    pacGrad.addColorStop(1, "#f9a825");
    ctx.fillStyle = pacGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eye
    const eyeDist = pr * 0.45;
    const eyeX = px + Math.cos(angle - 0.9) * eyeDist;
    const eyeY = py + Math.sin(angle - 0.9) * eyeDist;
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw ghosts
    for (const gh of g.ghosts) {
      const gx = gh.x * TILE + TILE / 2;
      const gy = gh.y * TILE + TILE / 2;
      const r = TILE / 2 - 1;
      const baseColor = gh.scared ? "#2222ff" : gh.color;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(gx + 2, gy + r + 2, r, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 10;

      // Body gradient
      const ghGrad = ctx.createRadialGradient(gx - 2, gy - 4, 1, gx, gy, r + 2);
      ghGrad.addColorStop(0, gh.scared ? "#64b5f6" : lightenColor(baseColor, 40));
      ghGrad.addColorStop(1, baseColor);
      ctx.fillStyle = ghGrad;

      ctx.beginPath();
      ctx.arc(gx, gy - 2, r, Math.PI, 0);
      ctx.lineTo(gx + r, gy + r - 2);
      for (let i = 0; i < 4; i++) {
        const waveX = gx + r - (i * 2 * r) / 4;
        const wavePhase = Math.sin(Date.now() / 150 + i) * 2;
        ctx.lineTo(waveX - r / 4, gy + r - 5 + wavePhase);
        ctx.lineTo(waveX - r / 2, gy + r - 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      if (!gh.scared) {
        const dxe = gh.dir.x * 2.5;
        const dye = gh.dir.y * 2.5;
        for (const side of [-3.5, 3.5]) {
          // White
          const eyeGrad = ctx.createRadialGradient(gx + side, gy - 3, 0, gx + side, gy - 3, 3.5);
          eyeGrad.addColorStop(0, "#ffffff");
          eyeGrad.addColorStop(1, "#e0e0e0");
          ctx.fillStyle = eyeGrad;
          ctx.beginPath();
          ctx.arc(gx + side, gy - 3, 3.5, 0, Math.PI * 2);
          ctx.fill();
          // Pupil
          ctx.fillStyle = "#1a237e";
          ctx.beginPath();
          ctx.arc(gx + side + dxe, gy - 3 + dye, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "white";
        for (const side of [-3, 3]) {
          ctx.beginPath();
          ctx.arc(gx + side, gy - 3, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(gx - 5, gy + 3);
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(gx - 5 + i * 2.5, gy + (i % 2 === 0 ? 3 : 6));
        }
        ctx.stroke();
      }
    }
  }, []);

  // Helper: lighten hex color
  function lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  /* ── Game loop ── */
  const gameLoop = useCallback((time: number) => {
    const g = gameRef.current;
    if (!g || !g.running) return;

    // Mouth animation
    g.animFrame++;
    if (g.animFrame % 3 === 0) {
      if (g.pacman.mouthOpen) {
        g.pacman.mouthAngle += 0.05;
        if (g.pacman.mouthAngle >= 0.3) g.pacman.mouthOpen = false;
      } else {
        g.pacman.mouthAngle -= 0.05;
        if (g.pacman.mouthAngle <= 0.02) g.pacman.mouthOpen = true;
      }
    }

    // Move Pac-Man
    if (time - g.lastMove > SPEED) {
      g.lastMove = time;
      const p = g.pacman;

      // Try next direction first
      const nx = ((p.x + p.nextDir.x) % COLS + COLS) % COLS;
      const ny = ((p.y + p.nextDir.y) % ROWS + ROWS) % ROWS;
      if (canMove(g.maze, nx, ny)) {
        p.dir = p.nextDir;
        p.x = nx;
        p.y = ny;
      } else {
        const cx = ((p.x + p.dir.x) % COLS + COLS) % COLS;
        const cy = ((p.y + p.dir.y) % ROWS + ROWS) % ROWS;
        if (canMove(g.maze, cx, cy)) {
          p.x = cx;
          p.y = cy;
        }
      }

      // Eat dot
      const tile = g.maze[p.y]?.[p.x];
      if (tile === 1) {
        g.maze[p.y][p.x] = 3;
        g.score += 10;
        g.dots--;
        setScore(g.score);
      } else if (tile === 2) {
        g.maze[p.y][p.x] = 3;
        g.score += 50;
        g.dots--;
        setScore(g.score);
        // Power pellet: scare ghosts
        for (const gh of g.ghosts) {
          gh.scared = true;
          gh.scaredTimer = 50;
        }
      }

      // Win check
      if (g.dots <= 0) {
        g.running = false;
        setHighScore((prev) => Math.max(prev, g.score));
        setGameState("won");
        draw();
        return;
      }
    }

    // Move ghosts
    if (time - g.lastGhostMove > GHOST_SPEED) {
      g.lastGhostMove = time;
      for (const gh of g.ghosts) {
        if (gh.scared) {
          gh.scaredTimer--;
          if (gh.scaredTimer <= 0) gh.scared = false;
        }

        // Get possible directions (no reversing)
        const reverse: Dir = { x: -gh.dir.x, y: -gh.dir.y };
        const possible = DIRS.filter(
          (d) =>
            canMove(g.maze, gh.x + d.x, gh.y + d.y) &&
            !(d.x === reverse.x && d.y === reverse.y)
        );

        if (possible.length === 0) {
          // Dead end, reverse
          if (canMove(g.maze, gh.x + reverse.x, gh.y + reverse.y)) {
            gh.dir = reverse;
          }
        } else if (possible.length === 1) {
          gh.dir = possible[0];
        } else {
          // At intersection: 70% chase, 30% random (or flee if scared)
          if (Math.random() < 0.7) {
            const target = gh.scared
              ? { x: gh.x + (gh.x - g.pacman.x), y: gh.y + (gh.y - g.pacman.y) }
              : { x: g.pacman.x, y: g.pacman.y };
            possible.sort((a, b) => {
              const da = (gh.x + a.x - target.x) ** 2 + (gh.y + a.y - target.y) ** 2;
              const db = (gh.x + b.x - target.x) ** 2 + (gh.y + b.y - target.y) ** 2;
              return da - db;
            });
            gh.dir = possible[0];
          } else {
            gh.dir = possible[Math.floor(Math.random() * possible.length)];
          }
        }

        gh.x = ((gh.x + gh.dir.x) % COLS + COLS) % COLS;
        gh.y = ((gh.y + gh.dir.y) % ROWS + ROWS) % ROWS;

        // Collision
        if (gh.x === g.pacman.x && gh.y === g.pacman.y) {
          if (gh.scared) {
            // Eat ghost
            gh.x = 10;
            gh.y = 9;
            gh.scared = false;
            g.score += 200;
            setScore(g.score);
          } else {
            // Lose life
            g.lives--;
            setLives(g.lives);
            if (g.lives <= 0) {
              g.running = false;
              setHighScore((prev) => Math.max(prev, g.score));
              setGameState("dead");
              draw();
              return;
            }
            // Reset positions
            g.pacman.x = 10;
            g.pacman.y = 15;
            g.pacman.dir = DIR_LEFT;
            g.pacman.nextDir = DIR_LEFT;
            g.ghosts[0].x = 9; g.ghosts[0].y = 9;
            g.ghosts[1].x = 10; g.ghosts[1].y = 9;
            g.ghosts[2].x = 11; g.ghosts[2].y = 9;
            g.ghosts[3].x = 10; g.ghosts[3].y = 10;
          }
        }
      }
    }

    draw();
    requestAnimationFrame(gameLoop);
  }, [draw]);

  /* ── Input ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g || !g.running) return;
      switch (e.key) {
        case "ArrowUp": case "z": case "w": g.pacman.nextDir = DIR_UP; e.preventDefault(); break;
        case "ArrowDown": case "s": g.pacman.nextDir = DIR_DOWN; e.preventDefault(); break;
        case "ArrowLeft": case "q": case "a": g.pacman.nextDir = DIR_LEFT; e.preventDefault(); break;
        case "ArrowRight": case "d": g.pacman.nextDir = DIR_RIGHT; e.preventDefault(); break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  /* ── Touch ── */
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const g = gameRef.current;
      if (!g || !g.running || !touchRef.current) return;
      const dx = e.changedTouches[0].clientX - touchRef.current.x;
      const dy = e.changedTouches[0].clientY - touchRef.current.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        g.pacman.nextDir = dx > 0 ? DIR_RIGHT : DIR_LEFT;
      } else {
        g.pacman.nextDir = dy > 0 ? DIR_DOWN : DIR_UP;
      }
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  /* ── Start / draw ── */
  useEffect(() => {
    if (gameState === "playing") {
      const g = gameRef.current;
      if (!g) return;
      g.running = true;
      requestAnimationFrame(gameLoop);
    }
  }, [gameState, gameLoop]);

  // Draw idle maze
  useEffect(() => {
    if (gameState === "idle") {
      gameRef.current = {
        maze: cloneMaze(),
        pacman: { x: 10, y: 15, dir: DIR_LEFT, nextDir: DIR_LEFT, mouthAngle: 0.2, mouthOpen: true },
        ghosts: [
          { x: 9, y: 9, dir: DIR_UP, color: GHOST_COLORS[0], scared: false, scaredTimer: 0 },
          { x: 10, y: 9, dir: DIR_UP, color: GHOST_COLORS[1], scared: false, scaredTimer: 0 },
          { x: 11, y: 9, dir: DIR_UP, color: GHOST_COLORS[2], scared: false, scaredTimer: 0 },
          { x: 10, y: 10, dir: DIR_DOWN, color: GHOST_COLORS[3], scared: false, scaredTimer: 0 },
        ],
        score: 0, lives: 3, dots: 0, running: false, lastMove: 0, lastGhostMove: 0, animFrame: 0,
      };
      draw();
    }
  }, [gameState, draw]);

  const canvasW = COLS * TILE;
  const canvasH = ROWS * TILE;

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.errorCode}>404</div>
        <h1 className={styles.title}>
          {gameState === "won" ? "Victoire !" : gameState === "dead" ? "Game Over" : "Page introuvable"}
        </h1>
        {gameState === "idle" && (
          <p className={styles.subtitle}>
            Pac-Man a dévoré cette page. Aidez-le à manger tous les points !
          </p>
        )}
      </div>

      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} width={canvasW} height={canvasH} className={styles.canvas} />

        {gameState !== "playing" && (
          <div className={styles.overlay}>
            {gameState === "idle" && (
              <button className={styles.playBtn} onClick={initGame}>
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                JOUER
              </button>
            )}
            {gameState === "won" && (
              <div className={styles.endScreen}>
                <div className={styles.endEmoji}>🏆</div>
                <div className={styles.endScore}>Score: {score}</div>
                <button className={styles.playBtn} onClick={initGame}>REJOUER</button>
              </div>
            )}
            {gameState === "dead" && (
              <div className={styles.endScreen}>
                <div className={styles.endEmoji}>👻</div>
                <div className={styles.endScore}>Score: {score}</div>
                <button className={styles.playBtn} onClick={initGame}>REJOUER</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.hud}>
        <div className={styles.hudItem}>
          SCORE <span>{String(score).padStart(6, "0")}</span>
        </div>
        <div className={styles.hudItem}>
          {Array.from({ length: lives }).map((_, i) => (
            <span key={i} className={styles.life} />
          ))}
        </div>
        {highScore > 0 && (
          <div className={styles.hudItem}>
            HIGH <span>{String(highScore).padStart(6, "0")}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <p className={styles.controlHint}>
          {gameState === "playing"
            ? "Flèches / ZQSD / Swipe pour diriger"
            : ""}
        </p>
        <Link href={homePath} className={styles.homeBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Accueil
        </Link>
      </div>

      {gameState === "playing" && (
        <div className={styles.mobileControls}>
          <button className={styles.dpadBtn} onClick={() => { if (gameRef.current) gameRef.current.pacman.nextDir = DIR_UP; }} aria-label="Haut">▲</button>
          <div className={styles.dpadRow}>
            <button className={styles.dpadBtn} onClick={() => { if (gameRef.current) gameRef.current.pacman.nextDir = DIR_LEFT; }} aria-label="Gauche">◀</button>
            <div className={styles.dpadCenter} />
            <button className={styles.dpadBtn} onClick={() => { if (gameRef.current) gameRef.current.pacman.nextDir = DIR_RIGHT; }} aria-label="Droite">▶</button>
          </div>
          <button className={styles.dpadBtn} onClick={() => { if (gameRef.current) gameRef.current.pacman.nextDir = DIR_DOWN; }} aria-label="Bas">▼</button>
        </div>
      )}
    </div>
  );
}
