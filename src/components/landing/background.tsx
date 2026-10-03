/**
 * Landing background: looping Kraków video (muted, decorative) under a dark scrim so light text stays readable.
 * Put the file at `public/videos/krakow.mp4`. If it is missing (or the user prefers reduced motion) the dark
 * base colour is shown instead, so the page still works.
 */
export function Background({ videoSrc = "/videos/krakow.mp4" }: { videoSrc?: string }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-[#2a1608]">
      <video
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-[#1c0e04]/65" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
    </div>
  );
}
