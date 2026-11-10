"use client";

import { PointerEvent, useRef } from "react";

const magnets = [
  { image: "/assets/hero1.webp", left: 11, top: 18, size: 31 },
  { image: "/assets/hero2.webp", left: 59, top: 11, size: 22 },
  { image: "/assets/hero3.webp", left: 18, top: 59, size: 26 },
  { image: "/assets/hero4.webp", left: 62, top: 57, size: 24 },
];

export function MagnetStage() {
  const stageRef = useRef<HTMLDivElement>(null);

  function attract(event: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage || event.pointerType === "touch") return;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const glow = stage.querySelector<HTMLElement>("[data-glow]");
    if (glow) {
      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
    }

    stage.querySelectorAll<HTMLElement>("[data-magnet]").forEach((magnet) => {
      const magnetBounds = magnet.getBoundingClientRect();
      const centerX = magnetBounds.left - bounds.left + magnetBounds.width / 2;
      const centerY = magnetBounds.top - bounds.top + magnetBounds.height / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = Math.min(34, 2800 / distance);
      magnet.style.transform = `translate(${(dx / distance) * pull}px, ${(dy / distance) * pull}px)`;
    });
  }

  function reset() {
    const stage = stageRef.current;
    if (!stage) return;
    stage
      .querySelectorAll<HTMLElement>("[data-magnet]")
      .forEach((magnet) => (magnet.style.transform = "translate(0, 0)"));
  }

  return (
    <div
      className="magnet-stage"
      ref={stageRef}
      onPointerMove={attract}
      onPointerLeave={reset}
      aria-label="Интерактивная композиция из неодимовых магнитов"
    >
      <div className="magnet-grid" />
      <div className="magnet-glow" data-glow />
      <span className="stage-hint">Наведите курсор — магниты притянутся</span>
      {magnets.map((magnet) => (
        <img
          data-magnet
          className="stage-magnet"
          src={magnet.image}
          alt=""
          key={magnet.image}
          style={{
            left: `${magnet.left}%`,
            top: `${magnet.top}%`,
            width: `${magnet.size}%`,
          }}
        />
      ))}
      <div className="stage-spec">
        <strong>от 1 мм</strong>
        <span>до тяги 1000 кг и выше</span>
      </div>
    </div>
  );
}
