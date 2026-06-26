/**
 * 多结局系统
 *
 * 根据玩家的道德选择（灰烬归还、同行者救助、证物收集）判定结局
 */

import { EndingKind, GameState } from "./types";

export interface EndingData {
  kind: EndingKind;
  title: string;
  description: string;
  color: string;
}

/**
 * 计算结局
 */
export function computeEnding(s: GameState): EndingData {
  const moral = s.moral;

  // 赎罪结局：归还了大部分灰烬，救下了同行者，直面了真相
  if (
    moral.ashesReturned >= 6 &&
    moral.survivorsSaved >= 2 &&
    moral.truthFaced >= 3 &&
    moral.ashesAbandoned === 0
  ) {
    return {
      kind: "redemption",
      title: "赎罪·晨光",
      description:
        "你把所有名字归还给了仪式点。雾松开了手，晨光照进港口。\n\n" +
        "沈迴站在破晓的海岸上。他终于想起了那个被留下的人——是他自己。\n\n" +
        "那场雨夜的事故里，他选择了先救别人，却再也没能回去。\n\n" +
        "雾记得他的选择，也记得他为此承担的代价。现在，它放行了。",
      color: "#f5c84a",
    };
  }

  // 否认结局：拒绝归还灰烬，抛弃同行者，只顾逃生
  if (
    moral.ashesAbandoned >= 4 &&
    moral.survivorsSacrificed >= 2 &&
    moral.cluesIgnored >= 4
  ) {
    return {
      kind: "denial",
      title: "否认·再沉",
      description:
        "你把灰烬留在了身后，把同行者推向了怪物。出口在眼前，但雾没有停下。\n\n" +
        "沈迴穿过了出口——然后又回到了第一层。\n\n" +
        "雾不接受忘记。每一次逃避，都只是让下一次下沉更深。\n\n" +
        "他会一直走下去，直到愿意回头。",
      color: "#666",
    };
  }

  // 牺牲结局：救下了所有同行者，但没有归还灰烬
  if (moral.survivorsSaved >= 3 && moral.ashesReturned < 3) {
    return {
      kind: "sacrifice",
      title: "牺牲·留守",
      description:
        "你救下了所有人，但没有归还那些名字。\n\n" +
        "沈迴把同行者送出了雾，自己留在了最后一层。\n\n" +
        "雾接受了这笔交易：他用自己的停留，换取了其他人的离开。\n\n" +
        "有些人注定要留在港口，等待下一个愿意下沉的人。",
      color: "#c4612f",
    };
  }

  // 真相结局：收集了所有证物，直面了真相，但选择保持沉默
  if (
    moral.truthFaced >= 5 &&
    moral.cluesIgnored === 0 &&
    moral.silenceChosen >= 2
  ) {
    return {
      kind: "truth",
      title: "真相·沉默",
      description:
        "你找到了所有证物，拼出了完整的真相。但你选择了不说出来。\n\n" +
        "沈迴离开了灰洄镇，带着那些名字和记忆。\n\n" +
        "雾放行了，但不是因为宽恕——而是因为它知道，有些真相不被说出来，\n\n" +
        "比被遗忘更沉重。",
      color: "#8a8a92",
    };
  }

  // 默认结局：无尽下沉
  return {
    kind: "endless",
    title: "无尽·下沉",
    description:
      "你逃出了雾，但没有完成任何承诺。\n\n" +
      "沈迴回到了镇外，但灰洄镇还在那里。雾还在那里。\n\n" +
      "他知道，只要还有未归还的名字，他就会再次回来。\n\n" +
      "雾会记得。它会一直等。",
    color: "#5c635d",
  };
}

/**
 * 根据玩家行为更新道德状态
 */
export function recordMoralChoice(
  s: GameState,
  choice: "ash-returned" | "ash-abandoned" | "survivor-saved" | "survivor-sacrificed" | "clue-ignored" | "truth-faced" | "silence-chosen"
) {
  switch (choice) {
    case "ash-returned":
      s.moral.ashesReturned++;
      break;
    case "ash-abandoned":
      s.moral.ashesAbandoned++;
      break;
    case "survivor-saved":
      s.moral.survivorsSaved++;
      break;
    case "survivor-sacrificed":
      s.moral.survivorsSacrificed++;
      break;
    case "clue-ignored":
      s.moral.cluesIgnored++;
      break;
    case "truth-faced":
      s.moral.truthFaced++;
      break;
    case "silence-chosen":
      s.moral.silenceChosen++;
      break;
  }
}
