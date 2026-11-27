"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/*
 * With a mouse, a service row shows its photograph above the pointer, so the row
 * itself stays readable. It renders straight after the list it serves. CSS picks the
 * picture and fades it (site.css, .svc-peek); this only moves it, writing the transform
 * straight onto the element, so nothing re-renders as the pointer travels. Touch
 * screens never show it, so they never load the pictures.
 */
export function ServicePeek({ photos }: { photos: { src: string; position?: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const peek = ref.current;
    const list = peek?.previousElementSibling;
    const frame = peek?.offsetParent; // Null while CSS hides it, on touch screens and narrow windows.
    if (!peek || !(list instanceof HTMLElement) || !frame || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const place = (event: PointerEvent) => {
      const box = frame.getBoundingClientRect();
      peek.style.transform = `translate(${Math.round(event.clientX - box.left)}px, ${Math.round(event.clientY - box.top)}px)`;
    };
    // Arriving, the picture starts where the pointer is rather than gliding in from a corner.
    const arrive = (event: PointerEvent) => {
      peek.style.transitionDuration = "0s";
      place(event);
      peek.getBoundingClientRect();
      peek.style.transitionDuration = "";
    };

    list.addEventListener("pointerenter", arrive);
    list.addEventListener("pointermove", place);
    return () => {
      list.removeEventListener("pointerenter", arrive);
      list.removeEventListener("pointermove", place);
    };
  }, []);

  return (
    <div ref={ref} className="svc-peek" aria-hidden="true">
      <span>
        {photos.map((photo) => (
          <Image key={photo.src} src={photo.src} alt="" width={600} height={450} sizes="300px" loading="lazy" style={photo.position ? { objectPosition: photo.position } : undefined}/>
        ))}
      </span>
    </div>
  );
}
