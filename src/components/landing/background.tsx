/**
 * Page background. Minimal gradient for now.
 * To add a Kraków video later, pass `videoSrc` (muted, looping, decorative): the dark scrim keeps text readable
 * and no layout change is needed. The video is hidden for users who prefer reduced motion.
 */
export function Background({ videoSrc }: { videoSrc?: string }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-cream">
      {videoSrc ? (
        <>
          <video
            className="absolute inset-0 size-full object-cover motion-reduce:hidden"
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-slate-950/50 motion-reduce:hidden" />
        </>
      ) : (
        <>
          <div className="animate-float-slow absolute -left-24 top-10 size-72 rounded-full bg-sage/40 blur-3xl" />
          <div className="animate-float-slow absolute -right-24 bottom-10 size-80 rounded-full bg-moss/20 blur-3xl [animation-delay:-4s]" />
        </>
      )}
    </div>
  );
}
