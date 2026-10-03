import { cn } from "@/lib/utils";

/** Required by the ODbL: credit OpenStreetMap wherever its data is shown. */
export function OsmAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-[10px] text-muted-foreground", className)}>
      Map data ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        OpenStreetMap contributors
      </a>
    </p>
  );
}
