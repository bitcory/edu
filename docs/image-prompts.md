# 그림책 만들기 — 이미지 프롬프트

> 이 파일은 `scripts/make-prompts.mjs` 가 생성합니다. 직접 고치지 마세요.
> 주인공·행동·장소를 바꾸려면 `app/lib/make-catalog.ts` 를 고치고 다시 생성하세요.

## 넣는 위치

```
$STORAGE_DIR/make/
  characters/<주인공>.png     ← 캐릭터 시트 겸 선택 화면 썸네일
  actions/<행동>.png          ← 행동 선택 썸네일
  locations/<장소>.png        ← 장소 선택 썸네일
  scenes/<주인공>__<행동>__<장소>/<1~5>.png   ← 본문
```

- 확장자는 `.png` `.jpg` `.jpeg` `.webp` 중 아무거나 됩니다.
- **아직 없는 그림은 앱이 자동으로 플레이스홀더를 그려 줍니다.** 한 장씩 채워 넣어도 흐름은 계속 동작합니다.
- 파일을 넣는 즉시 반영됩니다. 서버를 다시 띄울 필요 없습니다.

## 규격

- **가로세로 4:5 세로형** (1024 × 1280 권장). 이 비율만 지키면 픽셀 수는 자유입니다.
- 비율이 4:5 가 아니면 페이지에 맞춰 늘어나면서 찌그러집니다.
- **그림 안에 글자를 넣지 마세요.** 문장과 아이 이름은 앱이 별도 레이어로 얹습니다.
- 하단 20% 는 자막 띠가 덮으므로 중요한 것을 두지 마세요.

## 만드는 순서

1. **캐릭터 시트 7장을 먼저** 만듭니다. 이게 이후 모든 장면의 기준입니다.
2. 각 장면을 만들 때 해당 캐릭터 시트를 **레퍼런스 이미지로 넣으세요.** 안 그러면 5장에서 주인공 얼굴이 제각각 나옵니다.
3. 선택 화면 썸네일(행동·장소)은 아무 때나 만들어도 됩니다.

총 **328장** — 캐릭터 7 · 행동 3 · 장소 3 · 장면 315

---

## 1. 캐릭터 시트 (먼저 만드세요)

정면을 보고 서 있는 전신, 배경은 단색에 가깝게. 이후 장면의 레퍼런스로 씁니다.

### 👦 남자아이

`make/characters/boy.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 👧 여자아이

`make/characters/girl.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🐰 토끼

`make/characters/rabbit.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🐱 고양이

`make/characters/cat.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🐶 강아지

`make/characters/dog.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🐻 곰

`make/characters/bear.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🦊 여우

`make/characters/fox.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. Full-body character sheet of a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, standing facing the viewer, neutral happy expression, arms relaxed, simple soft solid pastel background. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

## 2. 선택 화면 썸네일

### 🎈 신나게 놀아요 — `make/actions/play.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. A symbolic, character-free illustration representing "신나게 놀아요" for a kids' menu tile: colorful balloons, a ball and a slide in bright sunshine. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🚶 즐겁게 가요 — `make/actions/go.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. A symbolic, character-free illustration representing "즐겁게 가요" for a kids' menu tile: a small backpack and a sunny path leading forward with flowers. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 📚 친구와 책을 읽어요 — `make/actions/read.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. A symbolic, character-free illustration representing "친구와 책을 읽어요" for a kids' menu tile: a big open picture book with soft light and floating stars. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🏫 유치원 — `make/locations/kindergarten.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. An empty establishing view of a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows, no characters present, inviting and warm. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🏖️ 바닷가 — `make/locations/beach.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. An empty establishing view of a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky, no characters present, inviting and warm. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

### 🏠 집 — `make/locations/home.png`

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. An empty establishing view of a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window, no characters present, inviting and warm. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

## 3. 장면

각 장면은 **해당 캐릭터 시트를 레퍼런스로 넣고** 만드세요.

---

# 👦 남자아이

> 레퍼런스: `make/characters/boy.png`

## 남자아이 · 유치원 · 신나게 놀아요

`make/scenes/boy__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 바닷가 · 신나게 놀아요

`make/scenes/boy__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 집 · 신나게 놀아요

`make/scenes/boy__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 유치원 · 즐겁게 가요

`make/scenes/boy__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 바닷가 · 즐겁게 가요

`make/scenes/boy__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 집 · 즐겁게 가요

`make/scenes/boy__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 유치원 · 친구와 책을 읽어요

`make/scenes/boy__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 바닷가 · 친구와 책을 읽어요

`make/scenes/boy__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 남자아이 · 집 · 친구와 책을 읽어요

`make/scenes/boy__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

# 👧 여자아이

> 레퍼런스: `make/characters/girl.png`

## 여자아이 · 유치원 · 신나게 놀아요

`make/scenes/girl__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 바닷가 · 신나게 놀아요

`make/scenes/girl__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 집 · 신나게 놀아요

`make/scenes/girl__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 유치원 · 즐겁게 가요

`make/scenes/girl__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 바닷가 · 즐겁게 가요

`make/scenes/girl__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 집 · 즐겁게 가요

`make/scenes/girl__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 유치원 · 친구와 책을 읽어요

`make/scenes/girl__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 바닷가 · 친구와 책을 읽어요

`make/scenes/girl__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여자아이 · 집 · 친구와 책을 읽어요

`make/scenes/girl__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

# 🐰 토끼

> 레퍼런스: `make/characters/rabbit.png`

## 토끼 · 유치원 · 신나게 놀아요

`make/scenes/rabbit__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 바닷가 · 신나게 놀아요

`make/scenes/rabbit__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 집 · 신나게 놀아요

`make/scenes/rabbit__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 유치원 · 즐겁게 가요

`make/scenes/rabbit__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 바닷가 · 즐겁게 가요

`make/scenes/rabbit__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 집 · 즐겁게 가요

`make/scenes/rabbit__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 유치원 · 친구와 책을 읽어요

`make/scenes/rabbit__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 바닷가 · 친구와 책을 읽어요

`make/scenes/rabbit__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 토끼 · 집 · 친구와 책을 읽어요

`make/scenes/rabbit__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

# 🐱 고양이

> 레퍼런스: `make/characters/cat.png`

## 고양이 · 유치원 · 신나게 놀아요

`make/scenes/cat__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 바닷가 · 신나게 놀아요

`make/scenes/cat__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 집 · 신나게 놀아요

`make/scenes/cat__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 유치원 · 즐겁게 가요

`make/scenes/cat__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 바닷가 · 즐겁게 가요

`make/scenes/cat__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 집 · 즐겁게 가요

`make/scenes/cat__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 유치원 · 친구와 책을 읽어요

`make/scenes/cat__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 바닷가 · 친구와 책을 읽어요

`make/scenes/cat__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 고양이 · 집 · 친구와 책을 읽어요

`make/scenes/cat__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

# 🐶 강아지

> 레퍼런스: `make/characters/dog.png`

## 강아지 · 유치원 · 신나게 놀아요

`make/scenes/dog__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 바닷가 · 신나게 놀아요

`make/scenes/dog__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 집 · 신나게 놀아요

`make/scenes/dog__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 유치원 · 즐겁게 가요

`make/scenes/dog__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 바닷가 · 즐겁게 가요

`make/scenes/dog__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 집 · 즐겁게 가요

`make/scenes/dog__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 유치원 · 친구와 책을 읽어요

`make/scenes/dog__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 바닷가 · 친구와 책을 읽어요

`make/scenes/dog__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 강아지 · 집 · 친구와 책을 읽어요

`make/scenes/dog__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

# 🐻 곰

> 레퍼런스: `make/characters/bear.png`

## 곰 · 유치원 · 신나게 놀아요

`make/scenes/bear__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 바닷가 · 신나게 놀아요

`make/scenes/bear__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 집 · 신나게 놀아요

`make/scenes/bear__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 유치원 · 즐겁게 가요

`make/scenes/bear__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 바닷가 · 즐겁게 가요

`make/scenes/bear__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 집 · 즐겁게 가요

`make/scenes/bear__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 유치원 · 친구와 책을 읽어요

`make/scenes/bear__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 바닷가 · 친구와 책을 읽어요

`make/scenes/bear__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 곰 · 집 · 친구와 책을 읽어요

`make/scenes/bear__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

---

# 🦊 여우

> 레퍼런스: `make/characters/fox.png`

## 여우 · 유치원 · 신나게 놀아요

`make/scenes/fox__play__kindergarten/`

**1.png** — 문장: "○○는 유치원에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, arriving happily, looking around with a big excited smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, running and jumping joyfully, arms up in the air, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, playing together in a happy circle with the friends, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 바닷가 · 신나게 놀아요

`make/scenes/fox__play__beach/`

**1.png** — 문장: "○○는 바닷가에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, arriving happily, looking around with a big excited smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, running and jumping joyfully, arms up in the air, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, playing together in a happy circle with the friends, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 집 · 신나게 놀아요

`make/scenes/fox__play__home/`

**1.png** — 문장: "○○는 집에 왔어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, arriving happily, looking around with a big excited smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○가 신나게 뛰어놀아요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, running and jumping joyfully, arms up in the air, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "친구들이 다가와 인사했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, meeting two friendly kid characters who wave hello, all smiling, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "모두 함께 즐겁게 놀았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, playing together in a happy circle with the friends, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "○○는 오늘도 참 행복했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, sitting down contentedly at golden hour, tired and happy, warm smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 유치원 · 즐겁게 가요

`make/scenes/fox__go__kindergarten/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, waking up brightly in morning light, stretching happily, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 유치원에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, putting on a small backpack, ready to set off, excited, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "유치원에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, arriving at the entrance with arms wide open in delight, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, waving hello to friends, beaming, a bright new day, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 바닷가 · 즐겁게 가요

`make/scenes/fox__go__beach/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, waking up brightly in morning light, stretching happily, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 바닷가에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, putting on a small backpack, ready to set off, excited, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "바닷가에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, arriving at the entrance with arms wide open in delight, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, waving hello to friends, beaming, a bright new day, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 집 · 즐겁게 가요

`make/scenes/fox__go__home/`

**1.png** — 문장: "아침 해가 반짝 떠올랐어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, waking up brightly in morning light, stretching happily, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "○○는 집에 갈 준비를 했어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, putting on a small backpack, ready to set off, excited, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "가는 길이 참 즐거웠어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, walking along a pleasant path, humming, birds and flowers nearby, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "집에 도착했어요!"

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, arriving at the entrance with arms wide open in delight, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "오늘도 좋은 하루가 시작돼요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, waving hello to friends, beaming, a bright new day, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 유치원 · 친구와 책을 읽어요

`make/scenes/fox__read__kindergarten/`

**1.png** — 문장: "○○는 유치원에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, opening a large colorful picture book, curious and eager, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 바닷가 · 친구와 책을 읽어요

`make/scenes/fox__read__beach/`

**1.png** — 문장: "○○는 바닷가에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, opening a large colorful picture book, curious and eager, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

## 여우 · 집 · 친구와 책을 읽어요

`make/scenes/fox__read__home/`

**1.png** — 문장: "○○는 집에서 책을 펼쳤어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, opening a large colorful picture book, curious and eager, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**2.png** — 문장: "친구들이 옆에 앉았어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, two friendly kid characters sitting down close by to look at the book together, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**3.png** — 문장: "함께 소리 내어 읽었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, reading aloud together, mouths open mid-word, delighted, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**4.png** — 문장: "이야기 속으로 쏙 빠져들었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, wide-eyed and absorbed, soft dreamy glow rising from the open book, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```

**5.png** — 문장: "마지막 장을 덮으며 미소 지었어요."

```
Pixar-style 3D animated children's picture book illustration, soft warm cinematic lighting, gentle pastel color palette, friendly rounded shapes, subtle depth of field, highly detailed, wholesome and safe for toddlers. a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child, gently closing the book with a satisfied, peaceful smile, in a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window. vertical 4:5 portrait composition; keep the main subject in the upper two-thirds; leave the bottom 20% visually calm (plain ground, sky, or soft blur) so a caption band can sit there without covering anything important. no text, no words, no letters, no captions, no watermark, no signature, no logo, no scary elements, no realistic human photography.
```
