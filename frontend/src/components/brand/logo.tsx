import Image from "next/image";

type Variant = "wordmark" | "lockup" | "symbol";
type Tone = "blue" | "paper" | "navy";

const DIMENSOES: Record<Variant, { width: number; height: number }> = {
  wordmark: { width: 2484, height: 360 },
  lockup: { width: 3528, height: 733 },
  symbol: { width: 1096, height: 841 },
};

export function Logo({
  variant = "lockup",
  tone = "blue",
  height = 28,
  priority = false,
}: {
  variant?: Variant;
  tone?: Tone;
  height?: number;
  priority?: boolean;
}) {
  const { width: w, height: h } = DIMENSOES[variant];

  return (
    <span className="inline-flex max-w-full">
      <Image
        src={`/brand/${variant}-${tone}.png`}
        alt="Nuvra"
        width={Math.round((w / h) * height)}
        height={height}
        priority={priority}
        className="flex-none"
        style={{ height, width: "auto" }}
      />
    </span>
  );
}
