// Renders a JSON-LD <script> for structured data. Server component — the
// markup is in the initial HTML, which is what crawlers and answer engines
// read. `data` is trusted, build-time content (see lib/seo.ts), never user
// input, so JSON.stringify straight into the tag is safe here.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
