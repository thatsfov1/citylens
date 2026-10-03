/**
 * Landing background: the Kraków video, softened (80% visible, blurred) over a light grey base.
 * The video is scaled up slightly so the blur does not leave soft edges. Hidden for reduced motion.
 */
export function Background({ videoSrc = "/videos/krakow.mp4" }: { videoSrc?: string }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-[#ebebeb]">
      <video
        className="absolute inset-0 size-full scale-110 object-cover opacity-80 blur-md motion-reduce:hidden"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-white/25" />
    </div>
  );
}
