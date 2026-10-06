// Transforma o "user agent" do navegador (um texto técnico enorme) num nome que a pessoa reconhece,
// como "Chrome no Windows". A ordem importa: o Edge e o Opera também dizem "Chrome", e o Chrome diz "Safari".
export function descreverDispositivo(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconhecido";

  const navegador = /Edg(e|A|iOS)?\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : null;

  const sistema = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iPhone/iPad"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "Mac"
          : /Linux|X11/.test(userAgent)
            ? "Linux"
            : null;

  if (navegador && sistema) return `${navegador} no ${sistema}`;
  return navegador ?? sistema ?? "Dispositivo desconhecido";
}
