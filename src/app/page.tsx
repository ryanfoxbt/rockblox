import { Editor } from "@/components/Editor";
import { HomeContent } from "@/components/HomeContent";
import { JsonLd } from "@/components/JsonLd";
import { homePageJsonLd } from "@/lib/seo";

export default function Home() {
  return (
    <>
      <Editor />
      <HomeContent />
      <JsonLd data={homePageJsonLd} />
    </>
  );
}
