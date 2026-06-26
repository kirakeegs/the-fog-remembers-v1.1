"use client";

import { useEffect, useState } from "react";
import type { StoryScene } from "@/game/storyScenes";

export default function StorySceneImage({
  scene,
  alt = "",
  className,
}: {
  scene: StoryScene;
  alt?: string;
  className?: string;
}) {
  const preferred = `/assets/story/${scene.assetSlug}.png`;
  const [src, setSrc] = useState(preferred);

  useEffect(() => {
    setSrc(preferred);
  }, [preferred]);

  return <img alt={alt} className={className} src={src} onError={() => setSrc(scene.image)} />;
}
