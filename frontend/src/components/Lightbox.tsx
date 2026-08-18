import { useEffect } from "react";

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onIndex: (index: number) => void;
}

export function Lightbox({ images, index, onClose, onIndex }: LightboxProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [images.length, index, onClose, onIndex]);

  if (!images[index]) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lightbox-close" type="button" onClick={onClose} aria-label="Close">
        [ x ]
      </button>
      {images.length > 1 && (
        <>
          <button
            className="lightbox-nav lightbox-prev"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndex((index - 1 + images.length) % images.length);
            }}
          >
            [ &lt; ]
          </button>
          <button
            className="lightbox-nav lightbox-next"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndex((index + 1) % images.length);
            }}
          >
            [ &gt; ]
          </button>
        </>
      )}
      <img
        src={images[index]}
        alt=""
        onClick={(event) => event.stopPropagation()}
      />
      <p className="lightbox-count">
        {index + 1} / {images.length}
      </p>
    </div>
  );
}
