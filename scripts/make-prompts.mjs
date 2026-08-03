// 「그림책 만들기」에 필요한 그림 전체의 이미지 프롬프트 문서를 생성한다.
//
//   node --experimental-strip-types scripts/make-prompts.mjs
//   → docs/image-prompts.md
//
// 카탈로그(app/lib/make-catalog.ts)가 유일한 원천이라, 주인공·행동·장소를
// 추가하면 문서도 자동으로 늘어난다. 손으로 문서를 고치지 말 것.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIONS,
  BEATS,
  CHARACTERS,
  LOCATIONS,
  PAGES_PER_BOOK,
  comboId,
} from "../app/lib/make-catalog.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 모든 그림에 공통으로 붙는 화풍. 63권이 한 세트로 보이려면 여기가 흔들리면 안 된다. */
const STYLE =
  "Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, " +
  "gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers";

/** 반드시 빼야 하는 것. 특히 글자 — 문장은 앱이 따로 얹는다. */
const NEGATIVE =
  "no text, no words, no letters, no captions, no watermark, no signature, no logo, " +
  "no scary elements, no realistic human photography";

/** 판형과 자막 자리. 페이지는 4:5 세로이고 하단에 흰 자막 띠가 깔린다. */
const COMPOSITION =
  "vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; " +
  "leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important";

const lines = [];
const out = (s = "") => lines.push(s);

out("# 그림책 만들기 — 이미지 프롬프트");
out();
out("> 이 파일은 `scripts/make-prompts.mjs` 가 생성합니다. 직접 고치지 마세요.");
out("> 주인공·행동·장소를 바꾸려면 `app/lib/make-catalog.ts` 를 고치고 다시 생성하세요.");
out();

out("## 넣는 위치");
out();
out("```");
out(`${process.env.STORAGE_DIR ?? "$STORAGE_DIR"}/make/`);
out("  characters/<주인공>.png     ← 캐릭터 시트 겸 선택 화면 썸네일");
out("  actions/<행동>.png          ← 행동 선택 썸네일");
out("  locations/<장소>.png        ← 장소 선택 썸네일");
out("  scenes/<주인공>__<행동>__<장소>/<1~5>.png   ← 본문");
out("```");
out();
out("- 확장자는 `.png` `.jpg` `.jpeg` `.webp` 중 아무거나 됩니다.");
out("- **아직 없는 그림은 앱이 자동으로 플레이스홀더를 그려 줍니다.** 한 장씩 채워 넣어도 흐름은 계속 동작합니다.");
out("- 파일을 넣는 즉시 반영됩니다. 서버를 다시 띄울 필요 없습니다.");
out();

out("## 규격");
out();
out("- **가로세로 4:5 세로형** (1024 × 1280 권장). 이 비율만 지키면 픽셀 수는 자유입니다.");
out("- 비율이 4:5 가 아니면 페이지에 맞춰 늘어나면서 찌그러집니다.");
out("- **그림 안에 글자를 넣지 마세요.** 문장과 아이 이름은 앱이 별도 레이어로 얹습니다.");
out("- 하단 20% 는 자막 띠가 덮으므로 중요한 것을 두지 마세요.");
out();

out("## 만드는 순서");
out();
out("1. **캐릭터 시트 7장을 먼저** 만듭니다. 이게 이후 모든 장면의 기준입니다.");
out("2. 각 장면을 만들 때 해당 캐릭터 시트를 **레퍼런스 이미지로 넣으세요.** 안 그러면 5장에서 주인공 얼굴이 제각각 나옵니다.");
out("3. 선택 화면 썸네일(행동·장소)은 아무 때나 만들어도 됩니다.");
out();

const total =
  CHARACTERS.length +
  ACTIONS.length +
  LOCATIONS.length +
  CHARACTERS.length * ACTIONS.length * LOCATIONS.length * PAGES_PER_BOOK;
out(`총 **${total}장** — 캐릭터 ${CHARACTERS.length} · 행동 ${ACTIONS.length} · 장소 ${LOCATIONS.length} · 장면 ${CHARACTERS.length * ACTIONS.length * LOCATIONS.length * PAGES_PER_BOOK}`);
out();
out("---");
out();

/* ---------------- 1. 캐릭터 시트 ---------------- */
out("## 1. 캐릭터 시트 (먼저 만드세요)");
out();
out("정면을 보고 서 있는 전신, 배경은 단색에 가깝게. 이후 장면의 레퍼런스로 씁니다.");
out();
for (const c of CHARACTERS) {
  out(`### ${c.emoji} ${c.label}`);
  out();
  out("`make/characters/" + c.id + ".png`");
  out();
  out("```");
  out(
    `${STYLE}. Full-body character sheet of ${c.look}, standing facing the viewer, ` +
      `neutral happy expression, arms relaxed, simple soft solid pastel background. ` +
      `${COMPOSITION}. ${NEGATIVE}.`,
  );
  out("```");
  out();
}

/* ---------------- 2. 선택 화면 썸네일 ---------------- */
out("---");
out();
out("## 2. 선택 화면 썸네일");
out();
for (const a of ACTIONS) {
  out(`### ${a.emoji} ${a.label} — \`make/actions/${a.id}.png\``);
  out();
  out("```");
  out(
    `${STYLE}. A symbolic, character-free illustration representing "${a.label}" for a kids' menu tile: ` +
      `${a.id === "play" ? "colorful balloons, a ball and a slide in bright sunshine" : a.id === "go" ? "a small backpack and a sunny path leading forward with flowers" : "a big open picture book with soft light and floating stars"}. ` +
      `${COMPOSITION}. ${NEGATIVE}.`,
  );
  out("```");
  out();
}
for (const l of LOCATIONS) {
  out(`### ${l.emoji} ${l.label} — \`make/locations/${l.id}.png\``);
  out();
  out("```");
  out(
    `${STYLE}. An empty establishing view of ${l.scene}, no characters present, inviting and warm. ` +
      `${COMPOSITION}. ${NEGATIVE}.`,
  );
  out("```");
  out();
}

/* ---------------- 3. 장면 ---------------- */
out("---");
out();
out("## 3. 장면");
out();
out("각 장면은 **해당 캐릭터 시트를 레퍼런스로 넣고** 만드세요.");
out();

for (const c of CHARACTERS) {
  out(`---`);
  out();
  out(`# ${c.emoji} ${c.label}`);
  out();
  out(`> 레퍼런스: \`make/characters/${c.id}.png\``);
  out();
  for (const a of ACTIONS) {
    for (const l of LOCATIONS) {
      const folder = comboId(c.id, a.id, l.id);
      out(`## ${c.label} · ${l.label} · ${a.label}`);
      out();
      out(`\`make/scenes/${folder}/\``);
      out();
      for (let i = 0; i < PAGES_PER_BOOK; i++) {
        const beat = BEATS[a.id][i];
        out(`**${i + 1}.png** — 문장: "${beat.text("○○", l)}"`);
        out();
        out("```");
        out(
          `${STYLE}. ${c.look}, ${beat.moment(l)}, in ${l.scene}. ` +
            `${COMPOSITION}. ${NEGATIVE}.`,
        );
        out("```");
        out();
      }
    }
  }
}

const target = path.join(ROOT, "docs", "image-prompts.md");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, lines.join("\n"), "utf8");
console.log(`생성: ${path.relative(ROOT, target)} (${total}장, ${lines.length}줄)`);
