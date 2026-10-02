'use client';
// EmojiPicker — the design-system icon picker, measured from the "emoji upload"
// HiFi frame:
//   panel  · 408px · paper-3 · r-xl · panel shadow (via PickerPanel)
//   tabs   · Emoji | Icons | Upload pills + quiet Remove right
//   search · 28px paper-2 field (r-md, hairline ring, disabled-text placeholder)
//            + bordered 28px shuffle + skin-tone cycle button
//   grid   · 12-up · 32px cells · 24px glyphs · 12/500 ink-5 category labels
//   rail   · 40px bottom category bar (Recent + one glyph per category);
//            clicking scrolls the grid, scrolling highlights the section
// Emits a page-icon value: an emoji, "ph:IconName", or an image data-URL.
import { useEffect, useRef, useState } from 'react';
import {
  Search, Shuffle, History, Smile, Leaf, Coffee,
  Dumbbell, Car, Lightbulb, Hash, Flag, SquarePlus, type IconType,
} from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui/icon';
import { Tooltip } from '@/components/ds/ui';
import { PAGE_ICONS } from '@/components/ui/page-icon';
import { PickerPanel, PickerTabs, PickerQuietAction } from '@/components/ui/picker-panel';
import { UploadZone } from '@/components/ui/upload-zone';
import { fileToDataUrl } from '@/lib/image';

// Compact emoji data: "<emoji> <search name>" pairs, comma-separated.
const parse = (s: string): [string, string][] =>
  s.split(',').map((p) => { const i = p.indexOf(' '); return [p.slice(0, i), p.slice(i + 1)] as [string, string]; });

const EMOJI_CATS: { name: string; icon: IconType; items: [string, string][] }[] = [
  { name: 'People', icon: Smile, items: parse('😀 grin,😃 smiley,😄 smile,😁 beam,😆 laugh,😅 sweat smile,🤣 rofl,😂 joy,🙂 slight smile,🙃 upside down,🫠 melting,😉 wink,😊 blush,😇 halo,🥰 love,😍 heart eyes,🤩 star struck,😘 kiss,😗 kissing,😚 kissing closed,😙 kissing smile,🥲 tear smile,😋 yum,😛 tongue,😜 wink tongue,🤪 zany,😝 squint tongue,🤑 money mouth,🤗 hug,🤭 hand over mouth,🫢 gasp,🫣 peeking,🤫 shush,🤔 thinking,🫡 salute,🤐 zipper,🤨 raised brow,😐 neutral,😑 expressionless,😶 no mouth,🫥 dotted,😏 smirk,😒 unamused,🙄 eye roll,😬 grimace,🤥 lying,😌 relieved,😔 pensive,😪 sleepy,🤤 drooling,😴 sleep,😷 mask,🤒 thermometer,🤕 bandage,🤢 nauseated,🤮 vomiting,🤧 sneeze,🥵 hot,🥶 cold,🥴 woozy,😵 dizzy,🤯 mind blown,🤠 cowboy,🥳 party,🥸 disguise,😎 cool,🤓 nerd,🧐 monocle,😕 confused,🫤 diagonal mouth,😟 worried,🙁 frown,😮 open mouth,😯 hushed,😲 astonished,🥺 pleading,🥹 holding tears,😦 frowning open,😧 anguished,😨 fearful,😰 anxious,😥 sad relieved,😢 cry,😭 sob,😱 scream,😖 confounded,😣 persevere,😞 disappointed,😓 downcast,😩 weary,😫 tired,🥱 yawn,😤 huff,😡 pouting,😠 angry,🤬 cursing,😈 devil,👿 angry devil,💀 skull,☠️ skull crossbones,💩 poo,🤡 clown,👹 ogre,👺 goblin,👻 ghost,👽 alien,👾 space invader,🤖 robot,😺 grinning cat,😸 grinning cat smile,😹 cat joy,😻 cat heart eyes,😼 wry cat,😽 kissing cat,🙀 weary cat,😿 crying cat,😾 pouting cat,🙈 see no evil,🙉 hear no evil,🙊 speak no evil,💋 kiss mark,💌 love letter,👋 wave,🤚 raised back hand,🖐 hand splayed,✋ raised hand,🖖 vulcan,🫱 rightwards hand,🫲 leftwards hand,🫳 palm down,🫴 palm up,👌 ok hand,🤌 pinched fingers,🤏 pinching,✌️ peace,🤞 crossed fingers,🫰 finger heart,🤟 love you,🤘 horns,🤙 call me,👈 point left,👉 point right,👆 point up,🖕 middle finger,👇 point down,☝️ index up,🫵 point at viewer,👍 thumbs up,👎 thumbs down,✊ raised fist,👊 fist,🤛 left fist,🤜 right fist,👏 clap,🙌 raised hands,🫶 heart hands,👐 open hands,🤲 palms up,🤝 handshake,🙏 pray,✍️ writing hand,💅 nail polish,🤳 selfie,💪 strong,🦾 mechanical arm,🦿 mechanical leg,🦵 leg,🦶 foot,👂 ear,🦻 hearing aid,👃 nose,🧠 brain,🫀 heart organ,🫁 lungs,🦷 tooth,🦴 bone,👀 eyes,👁 eye,👅 tongue anatomy,👄 mouth,🫦 biting lip,👶 baby,🧒 child,👦 boy,👧 girl,🧑 person,👨 man,👩 woman,🧓 older person,👴 old man,👵 old woman,🙍 frowning person,🙎 pouting person,🙅 no gesture,🙆 ok gesture,💁 tipping hand,🙋 raising hand,🧏 deaf person,🙇 bowing,🤦 facepalm,🤷 shrug,🧑‍⚕️ health worker,🧑‍🎓 student,🧑‍🏫 teacher,🧑‍⚖️ judge,🧑‍🌾 farmer,🧑‍🍳 cook,🧑‍🔧 mechanic,🧑‍🏭 factory worker,🧑‍💼 office worker,🧑‍🔬 scientist,🧑‍💻 technologist,🧑‍🎤 singer,🧑‍🎨 artist,🧑‍✈️ pilot,🧑‍🚀 astronaut,🧑‍🚒 firefighter,👮 police,🕵️ detective,💂 guard,🥷 ninja,👷 construction worker,🫅 person with crown,🤴 prince,👸 princess,👳 turban,👲 skullcap,🧕 headscarf,🤵 tuxedo,👰 veil,🤰 pregnant,🤱 breastfeeding,👼 baby angel,🎅 santa,🤶 mrs claus,🦸 superhero,🦹 supervillain,🧙 mage,🧚 fairy,🧛 vampire,🧜 merperson,🧝 elf,🧞 genie,🧟 zombie,🧌 troll,💆 massage,💇 haircut,🚶 walking,🧍 standing,🧎 kneeling,🏃 running,💃 dancer,🕺 man dancing,🕴 levitating,👯 bunny ears,🧖 sauna,🧗 climbing,🤺 fencing,🏇 horse racing,⛷ skier,🏂 snowboarder,🏌 golfing,🏄 surfing,🚣 rowing,🏊 swimming,⛹ bouncing ball,🏋 weight lifting,🚴 biking,🚵 mountain biking,🤸 cartwheel,🤼 wrestling,🤽 water polo,🤾 handball,🤹 juggling,🧘 lotus,🛀 bath,🛌 in bed,🧑‍🤝‍🧑 people holding hands,💏 kiss couple,💑 couple heart,👪 family,🗣 speaking head,👤 silhouette,👥 silhouettes,🫂 people hugging,👣 footprints') },
  { name: 'Nature', icon: Leaf, items: parse('🐶 dog face,🐕 dog,🦮 guide dog,🐩 poodle,🐺 wolf,🦊 fox,🦝 raccoon,🐱 cat face,🐈 cat,🦁 lion,🐯 tiger face,🐅 tiger,🐆 leopard,🐴 horse face,🫎 moose,🫏 donkey,🐎 horse,🦄 unicorn,🦓 zebra,🦌 deer,🦬 bison,🐮 cow face,🐂 ox,🐃 water buffalo,🐄 cow,🐷 pig face,🐖 pig,🐗 boar,🐽 pig nose,🐏 ram,🐑 ewe,🐐 goat,🐪 camel,🐫 two hump camel,🦙 llama,🦒 giraffe,🐘 elephant,🦣 mammoth,🦏 rhinoceros,🦛 hippopotamus,🐭 mouse face,🐁 mouse,🐀 rat,🐹 hamster,🐰 rabbit face,🐇 rabbit,🐿 chipmunk,🦫 beaver,🦔 hedgehog,🦇 bat,🐻 bear,🐻‍❄️ polar bear,🐨 koala,🐼 panda,🦥 sloth,🦦 otter,🦨 skunk,🦘 kangaroo,🦡 badger,🐾 paw prints,🦃 turkey,🐔 chicken,🐓 rooster,🐣 hatching chick,🐤 baby chick,🐥 front chick,🐦 bird,🐧 penguin,🕊 dove,🦅 eagle,🦆 duck,🦢 swan,🦉 owl,🦤 dodo,🪶 feather,🦩 flamingo,🦚 peacock,🦜 parrot,🪽 wing,🐦‍⬛ black bird,🪿 goose,🐸 frog,🐊 crocodile,🐢 turtle,🦎 lizard,🐍 snake,🐲 dragon face,🐉 dragon,🦕 sauropod,🦖 t rex,🐳 spouting whale,🐋 whale,🐬 dolphin,🦭 seal,🐟 fish,🐠 tropical fish,🐡 blowfish,🦈 shark,🐙 octopus,🐚 shell,🪸 coral,🪼 jellyfish,🐌 snail,🦋 butterfly,🐛 bug,🐜 ant,🐝 honeybee,🪲 beetle,🐞 lady beetle,🦗 cricket,🪳 cockroach,🕷 spider,🕸 spider web,🦂 scorpion,🦟 mosquito,🪰 fly,🪱 worm,🦠 microbe,💐 bouquet,🌸 cherry blossom,💮 white flower,🪷 lotus,🏵 rosette,🌹 rose,🥀 wilted flower,🌺 hibiscus,🌻 sunflower,🌼 blossom,🌷 tulip,🪻 hyacinth,🌱 seedling,🪴 potted plant,🌲 evergreen,🌳 deciduous,🌴 palm,🌵 cactus,🌾 sheaf of rice,🌿 herb,☘️ shamrock,🍀 four leaf clover,🍁 maple leaf,🍂 fallen leaves,🍃 leaf in wind,🪹 empty nest,🪺 nest with eggs,🍄 mushroom,🌍 globe europe,🌎 globe americas,🌏 globe asia,🪐 ringed planet,⭐ star,🌟 glowing star,✨ sparkles,⚡ lightning,☄️ comet,💥 collision,🔥 fire,🌪 tornado,🌈 rainbow,☀️ sun,🌤 sun behind cloud,⛅ partly sunny,🌥 sun behind large cloud,☁️ cloud,🌦 sun behind rain,🌧 rain cloud,⛈ thunder cloud,🌩 lightning cloud,🌨 snow cloud,❄️ snowflake,☃️ snowman,⛄ snowman no snow,🌬 wind face,💨 dash,💧 droplet,💦 sweat droplets,☔ umbrella rain,🌊 wave,🌑 new moon,🌒 waxing crescent,🌓 first quarter,🌔 waxing gibbous,🌕 full moon,🌖 waning gibbous,🌗 last quarter,🌘 waning crescent,🌙 crescent moon,🌚 new moon face,🌛 first quarter face,🌜 last quarter face,🌡 thermometer,🌝 full moon face,🌞 sun face') },
  { name: 'Food', icon: Coffee, items: parse('🍇 grapes,🍈 melon,🍉 watermelon,🍊 tangerine,🍋 lemon,🍌 banana,🍍 pineapple,🥭 mango,🍎 red apple,🍏 green apple,🍐 pear,🍑 peach,🍒 cherries,🍓 strawberry,🫐 blueberries,🥝 kiwi,🍅 tomato,🫒 olive,🥥 coconut,🥑 avocado,🍆 aubergine,🥔 potato,🥕 carrot,🌽 corn,🌶 hot pepper,🫑 bell pepper,🥒 cucumber,🥬 leafy green,🥦 broccoli,🧄 garlic,🧅 onion,🥜 peanuts,🫘 beans,🌰 chestnut,🫚 ginger,🫛 pea pod,🍞 bread,🥐 croissant,🥖 baguette,🫓 flatbread,🥨 pretzel,🥯 bagel,🥞 pancakes,🧇 waffle,🧀 cheese,🍖 meat on bone,🍗 poultry leg,🥩 cut of meat,🥓 bacon,🍔 hamburger,🍟 fries,🍕 pizza,🌭 hot dog,🥪 sandwich,🌮 taco,🌯 burrito,🫔 tamale,🥙 stuffed flatbread,🧆 falafel,🥚 egg,🍳 cooking,🥘 shallow pan,🍲 pot of food,🫕 fondue,🥣 bowl with spoon,🥗 green salad,🍿 popcorn,🧈 butter,🧂 salt,🥫 canned food,🍱 bento,🍘 rice cracker,🍙 rice ball,🍚 cooked rice,🍛 curry rice,🍜 steaming bowl,🍝 spaghetti,🍠 roasted sweet potato,🍢 oden,🍣 sushi,🍤 fried shrimp,🍥 fish cake,🥮 moon cake,🍡 dango,🥟 dumpling,🥠 fortune cookie,🥡 takeout box,🦀 crab,🦞 lobster,🦐 shrimp,🦑 squid,🦪 oyster,🍦 soft ice cream,🍧 shaved ice,🍨 ice cream,🍩 doughnut,🍪 cookie,🎂 birthday cake,🍰 shortcake,🧁 cupcake,🥧 pie,🍫 chocolate,🍬 candy,🍭 lollipop,🍮 custard,🍯 honey pot,🍼 baby bottle,🥛 milk,☕ hot beverage,🫖 teapot,🍵 teacup,🍶 sake,🍾 bottle popping,🍷 wine,🍸 cocktail,🍹 tropical drink,🍺 beer,🍻 clinking beers,🥂 clinking glasses,🥃 tumbler,🫗 pouring liquid,🥤 cup with straw,🧋 bubble tea,🧃 beverage box,🧉 mate,🧊 ice,🥢 chopsticks,🍽 fork and knife with plate,🍴 fork and knife,🥄 spoon') },
  { name: 'Activity', icon: Dumbbell, items: parse('🎃 jack o lantern,🎄 christmas tree,🎆 fireworks,🎇 sparkler,🧨 firecracker,🎈 balloon,🎉 party popper,🎊 confetti ball,🎋 tanabata tree,🎍 pine decoration,🎎 japanese dolls,🎏 carp streamer,🎐 wind chime,🎑 moon ceremony,🧧 red envelope,🎀 ribbon,🎁 gift,🎗 reminder ribbon,🎟 admission tickets,🎫 ticket,🎖 military medal,🏆 trophy,🏅 sports medal,🥇 gold medal,🥈 silver medal,🥉 bronze medal,⚽ soccer,⚾ baseball,🥎 softball,🏀 basketball,🏐 volleyball,🏈 american football,🏉 rugby,🎾 tennis,🥏 flying disc,🎳 bowling,🏏 cricket game,🏑 field hockey,🏒 ice hockey,🥍 lacrosse,🏓 ping pong,🏸 badminton,🥊 boxing glove,🥋 martial arts,🥅 goal net,⛳ golf flag,⛸ ice skate,🎣 fishing pole,🤿 diving mask,🎽 running shirt,🎿 skis,🛷 sled,🥌 curling stone,🎯 bullseye,🪀 yo yo,🪁 kite,🔫 water pistol,🎱 pool 8 ball,🔮 crystal ball,🪄 magic wand,🎮 video game,🕹 joystick,🎰 slot machine,🎲 game die,🧩 jigsaw,🧸 teddy bear,🪅 pinata,🪩 mirror ball,🪆 nesting dolls,♠️ spade,♥️ heart suit,♦️ diamond suit,♣️ club,♟ chess pawn,🃏 joker,🀄 mahjong,🎴 flower cards,🎭 performing arts,🖼 framed picture,🎨 artist palette,🧵 thread,🪡 sewing needle,🧶 yarn,🪢 knot,🎪 circus tent,🎤 microphone,🎧 headphone,🎼 musical score,🎵 musical note,🎶 musical notes,🎹 piano,🥁 drum,🪘 long drum,🎷 saxophone,🎺 trumpet,🪗 accordion,🎸 guitar,🪕 banjo,🎻 violin,🪈 flute,🎬 clapper board,🎥 movie camera,📽 film projector,🎞 film frames') },
  { name: 'Travel', icon: Car, items: parse('🚗 car,🚕 taxi,🚙 sport utility vehicle,🚌 bus,🚎 trolleybus,🏎 racing car,🚓 police car,🚑 ambulance,🚒 fire engine,🚐 minibus,🛻 pickup truck,🚚 delivery truck,🚛 articulated lorry,🚜 tractor,🦯 white cane,🦽 manual wheelchair,🦼 motorized wheelchair,🛴 kick scooter,🚲 bicycle,🛵 motor scooter,🏍 motorcycle,🛺 auto rickshaw,🚨 police light,🚔 oncoming police car,🚍 oncoming bus,🚘 oncoming automobile,🚖 oncoming taxi,🚡 aerial tramway,🚠 mountain cableway,🚟 suspension railway,🚃 railway car,🚋 tram car,🚞 mountain railway,🚝 monorail,🚄 bullet train,🚅 bullet train nose,🚈 light rail,🚂 locomotive,🚆 train,🚇 metro,🚊 tram,🚉 station,✈️ airplane,🛫 departure,🛬 arrival,🛩 small airplane,💺 seat,🚁 helicopter,🚟 railway,🪂 parachute,🚀 rocket,🛸 flying saucer,🛎 bellhop bell,🧳 luggage,⌛ hourglass done,⏳ hourglass flowing,⌚ watch,⏰ alarm clock,⏱ stopwatch,⏲ timer clock,🕰 mantelpiece clock,🌡 thermometer,🗺 world map,🧭 compass,🏔 snow mountain,⛰ mountain,🌋 volcano,🗻 mount fuji,🏕 camping,🏖 beach with umbrella,🏜 desert,🏝 desert island,🏞 national park,🏟 stadium,🏛 classical building,🏗 building construction,🧱 brick,🪨 rock,🪵 wood,🛖 hut,🏘 houses,🏚 derelict house,🏠 house,🏡 house with garden,🏢 office building,🏣 japanese post office,🏤 post office,🏥 hospital,🏦 bank,🏨 hotel,🏩 love hotel,🏪 convenience store,🏫 school,🏬 department store,🏭 factory,🏯 japanese castle,🏰 castle,💒 wedding,🗼 tokyo tower,🗽 statue of liberty,⛪ church,🕌 mosque,🛕 hindu temple,🕍 synagogue,⛩ shinto shrine,🕋 kaaba,⛲ fountain,⛺ tent,🌁 foggy,🌃 night stars,🏙 cityscape,🌄 sunrise over mountains,🌅 sunrise,🌆 dusk,🌇 sunset,🌉 bridge at night,♨️ hot springs,🎠 carousel,🛝 playground slide,🎡 ferris wheel,🎢 roller coaster,💈 barber pole,⛵ sailboat,🛶 canoe,🚤 speedboat,🛳 passenger ship,⛴ ferry,🛥 motor boat,🚢 ship,⚓ anchor,🪝 hook,⛽ fuel pump,🚏 bus stop,🚦 traffic light,🚥 horizontal traffic light,🗿 moai,🛰 satellite') },
  { name: 'Objects', icon: Lightbulb, items: parse('⌚ watch,📱 mobile phone,📲 phone with arrow,💻 laptop,⌨️ keyboard,🖥 desktop computer,🖨 printer,🖱 computer mouse,🖲 trackball,🕹 joystick,🗜 clamp,💽 minidisc,💾 floppy disk,💿 optical disk,📀 dvd,🧮 abacus,🎥 movie camera,📷 camera,📸 camera flash,📹 video camera,📼 videocassette,🔍 magnifying left,🔎 magnifying right,🕯 candle,💡 light bulb,🔦 flashlight,🏮 red lantern,🪔 diya lamp,📔 notebook decorative,📕 closed book,📖 open book,📗 green book,📘 blue book,📙 orange book,📚 books,📓 notebook,📒 ledger,📃 page with curl,📜 scroll,📄 page facing up,📰 newspaper,🗞 rolled newspaper,📑 bookmark tabs,🔖 bookmark,🏷 label,💰 money bag,🪙 coin,💴 yen,💵 dollar,💶 euro,💷 pound,💸 money with wings,💳 credit card,🧾 receipt,💹 chart increasing yen,✉️ envelope,📧 e mail,📨 incoming envelope,📩 envelope with arrow,📤 outbox tray,📥 inbox tray,📦 package,📫 closed mailbox,📪 closed mailbox lowered,📬 open mailbox,📭 open mailbox lowered,📮 postbox,🗳 ballot box,✏️ pencil,✒️ black nib,🖋 fountain pen,🖊 pen,🖌 paintbrush,🖍 crayon,📝 memo,💼 briefcase,📁 file folder,📂 open file folder,🗂 card index dividers,📅 calendar,📆 tear off calendar,🗒 spiral notepad,🗓 spiral calendar,📇 card index,📈 chart increasing,📉 chart decreasing,📊 bar chart,📋 clipboard,📌 pushpin,📍 round pushpin,📎 paperclip,🖇 linked paperclips,📏 straight ruler,📐 triangular ruler,✂️ scissors,🗃 card file box,🗄 file cabinet,🗑 wastebasket,🔒 locked,🔓 unlocked,🔏 lock with pen,🔐 lock with key,🔑 key,🗝 old key,🔨 hammer,🪓 axe,⛏ pick,⚒️ hammer and pick,🛠 hammer and wrench,🗡 dagger,⚔️ crossed swords,💣 bomb,🪃 boomerang,🏹 bow and arrow,🛡 shield,🪚 saw,🔧 wrench,🪛 screwdriver,🔩 nut and bolt,⚙️ gear,🗜 compression,⚖️ balance scale,🦯 probing cane,🔗 link,⛓ chains,🪝 hook object,🧰 toolbox,🧲 magnet,🪜 ladder,⚗️ alembic,🧪 test tube,🧫 petri dish,🧬 dna,🔬 microscope,🔭 telescope,📡 satellite antenna,💉 syringe,🩸 blood drop,💊 pill,🩹 adhesive bandage,🩼 crutch,🩺 stethoscope,🩻 x ray,🚪 door,🛗 elevator,🪞 mirror,🪟 window,🛏 bed,🛋 couch and lamp,🪑 chair,🚽 toilet,🪠 plunger,🚿 shower,🛁 bathtub,🪤 mouse trap,🪒 razor,🧴 lotion bottle,🧷 safety pin,🧹 broom,🧺 basket,🧻 roll of paper,🪣 bucket,🧼 soap,🫧 bubbles,🪥 toothbrush,🧽 sponge,🧯 fire extinguisher,🛒 shopping cart,🚬 cigarette,⚰️ coffin,🪦 headstone,⚱️ funeral urn,🗿 moai object,🪧 placard,🪪 identification card,👓 glasses,🕶 sunglasses,🥽 goggles,🥼 lab coat,🦺 safety vest,👔 necktie,👕 t shirt,👖 jeans,🧣 scarf,🧤 gloves,🧥 coat,🧦 socks,👗 dress,👘 kimono,🥻 sari,🩱 one piece swimsuit,🩲 briefs,🩳 shorts,👙 bikini,👚 woman clothes,👛 purse,👜 handbag,👝 clutch bag,🛍 shopping bags,🎒 backpack,🩴 thong sandal,👞 mans shoe,👟 running shoe,🥾 hiking boot,🥿 flat shoe,👠 high heel,👡 sandal,🩰 ballet shoes,👢 boot,👑 crown,👒 womans hat,🎩 top hat,🎓 graduation cap,🧢 billed cap,🪖 military helmet,⛑ rescue helmet,📿 prayer beads,💄 lipstick,💍 ring,💎 gem stone') },
  { name: 'Symbols', icon: Hash, items: parse('❤️ red heart,🩷 pink heart,🧡 orange heart,💛 yellow heart,💚 green heart,💙 blue heart,🩵 light blue heart,💜 purple heart,🤎 brown heart,🖤 black heart,🩶 grey heart,🤍 white heart,💔 broken heart,❣️ heart exclamation,💕 two hearts,💞 revolving hearts,💓 beating heart,💗 growing heart,💖 sparkling heart,💘 heart with arrow,💝 heart with ribbon,💟 heart decoration,☮️ peace,✝️ latin cross,☪️ star and crescent,🕉 om,☸️ wheel of dharma,✡️ star of david,🔯 six pointed star,🕎 menorah,☯️ yin yang,☦️ orthodox cross,🛐 place of worship,⛎ ophiuchus,♈ aries,♉ taurus,♊ gemini,♋ cancer,♌ leo,♍ virgo,♎ libra,♏ scorpio,♐ sagittarius,♑ capricorn,♒ aquarius,♓ pisces,🆔 id,⚛️ atom symbol,🉑 acceptable,☢️ radioactive,☣️ biohazard,📴 mobile off,📳 vibration mode,🈶 not free,🈚 free,🈸 application,🈺 open for business,🈷️ monthly amount,✴️ eight pointed star,🆚 vs,💮 white flower symbol,🉐 bargain,㊙️ secret,㊗️ congratulations,🈴 passing grade,🈵 no vacancy,🔴 red circle,🟠 orange circle,🟡 yellow circle,🟢 green circle,🔵 blue circle,🟣 purple circle,🟤 brown circle,⚫ black circle,⚪ white circle,🟥 red square,🟧 orange square,🟨 yellow square,🟩 green square,🟦 blue square,🟪 purple square,🟫 brown square,⬛ black large square,⬜ white large square,◼️ black medium square,◻️ white medium square,🔶 large orange diamond,🔷 large blue diamond,🔸 small orange diamond,🔹 small blue diamond,🔺 red triangle up,🔻 red triangle down,💠 diamond with dot,🔘 radio button,🔳 white square button,🔲 black square button,✅ check mark button,☑️ check box,✔️ check mark,❌ cross mark,❎ cross mark button,➕ plus,➖ minus,➗ divide,✖️ multiply,🟰 heavy equals,♾️ infinity,‼️ double exclamation,⁉️ exclamation question,❓ question,❔ white question,❕ white exclamation,❗ exclamation,〰️ wavy dash,💯 hundred points,🔠 input latin uppercase,🔡 input latin lowercase,🔢 input numbers,🔣 input symbols,🔤 input latin letters,🅰️ a button,🆎 ab button,🅱️ b button,🆑 cl button,🆒 cool button,🆓 free button,ℹ️ information,🆕 new button,🆖 ng button,🅾️ o button,🆗 ok button,🅿️ p button,🆘 sos button,🆙 up button,🆒 cool,⚠️ warning,🚸 children crossing,⛔ no entry,🚫 prohibited,🚳 no bicycles,🚭 no smoking,☢ radioactive sign,🔞 no one under eighteen,📵 no mobile phones,🔅 dim button,🔆 bright button,♻️ recycling,⚜️ fleur de lis,🔱 trident,📛 name badge,🔰 japanese beginner,⭕ hollow red circle,🈁 here,🔃 clockwise arrows,🔄 counterclockwise arrows,🔀 shuffle,🔁 repeat,🔂 repeat one,▶️ play,⏸️ pause,⏹️ stop,⏺️ record,⏭️ next track,⏮️ last track,⏩ fast forward,⏪ rewind,🔼 up button small,🔽 down button small,🔊 speaker high,🔇 muted,🔔 bell,🔕 bell slash,📣 megaphone,📢 loudspeaker,💬 speech balloon,💭 thought balloon,🗯 right anger bubble,♠️ spades,♣️ clubs,🃏 joker card,🕐 one oclock,🕑 two oclock,🕒 three oclock,🕓 four oclock,🕔 five oclock,🕕 six oclock') },
  { name: 'Flags', icon: Flag, items: parse('🏳️ white flag,🏴 black flag,🏁 chequered flag,🚩 triangular flag,🏳️‍🌈 rainbow flag,🏳️‍⚧️ transgender flag,🏴‍☠️ pirate flag,🇺🇸 united states,🇬🇧 united kingdom,🇨🇦 canada,🇦🇺 australia,🇮🇳 india,🇯🇵 japan,🇨🇳 china,🇰🇷 south korea,🇩🇪 germany,🇫🇷 france,🇮🇹 italy,🇪🇸 spain,🇵🇹 portugal,🇳🇱 netherlands,🇧🇪 belgium,🇨🇭 switzerland,🇦🇹 austria,🇸🇪 sweden,🇳🇴 norway,🇩🇰 denmark,🇫🇮 finland,🇮🇸 iceland,🇮🇪 ireland,🇵🇱 poland,🇨🇿 czechia,🇸🇰 slovakia,🇭🇺 hungary,🇷🇴 romania,🇧🇬 bulgaria,🇬🇷 greece,🇭🇷 croatia,🇷🇸 serbia,🇺🇦 ukraine,🇷🇺 russia,🇹🇷 turkey,🇧🇷 brazil,🇲🇽 mexico,🇦🇷 argentina,🇨🇱 chile,🇨🇴 colombia,🇵🇪 peru,🇻🇪 venezuela,🇿🇦 south africa,🇳🇬 nigeria,🇰🇪 kenya,🇬🇭 ghana,🇪🇬 egypt,🇲🇦 morocco,🇸🇦 saudi arabia,🇦🇪 united arab emirates,🇶🇦 qatar,🇮🇱 israel,🇮🇷 iran,🇵🇰 pakistan,🇧🇩 bangladesh,🇱🇰 sri lanka,🇳🇵 nepal,🇸🇬 singapore,🇲🇾 malaysia,🇮🇩 indonesia,🇹🇭 thailand,🇻🇳 vietnam,🇵🇭 philippines,🇰🇭 cambodia,🇹🇼 taiwan,🇭🇰 hong kong,🇳🇿 new zealand') },
];
const ALL_EMOJI = EMOJI_CATS.flatMap((c) => c.items);
const ICON_NAMES = Object.keys(PAGE_ICONS);

// Skin-tone support — the Fitzpatrick modifier cycle, applied on pick to the
// hand/person glyphs that accept it (variation selectors stripped first).
const TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
const TONABLE = new Set(['👋', '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '🤞']);
const withTone = (e: string, tone: string) =>
  tone && TONABLE.has(e) ? e.replace(/️/g, '') + tone : e;

const RECENT_KEY = 'zb:emoji-recent';
const TONE_KEY = 'zb:emoji-tone';

type Tab = 'emoji' | 'icons' | 'upload';

// Grid cell — 12-up, 32px, hover wash (shared by emoji + icon tabs).
const cell: React.CSSProperties = { display: 'grid', placeItems: 'center', height: 32, border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', padding: 0 };
const catLabel: React.CSSProperties = { fontSize: 'var(--text-caption-size)', fontWeight: 500, lineHeight: '12px', color: 'var(--text-muted)', padding: '10px 0 8px', marginLeft: -4 };

export function EmojiPicker({ onPick, onRemove, onClose, align = 'left' }: {
  onPick: (icon: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const [tab, setTab] = useState<Tab>('emoji');
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tone, setTone] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState<string>('People');
  const scrollRef = useRef<HTMLDivElement>(null);
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    try {
      const r = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
      if (Array.isArray(r)) { setRecent(r.filter((x) => typeof x === 'string')); if (r.length) setActiveCat('Recent'); }
      const t = Number(window.localStorage.getItem(TONE_KEY));
      if (t >= 0 && t < TONES.length) setTone(t);
    } catch { /* storage unavailable */ }
  }, []);

  const pickEmoji = (e: string) => {
    const val = withTone(e, TONES[tone]);
    try {
      const next = [val, ...recent.filter((x) => x !== val)].slice(0, 24);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
    onPick(val);
    onClose();
  };
  const cycleTone = () => {
    const next = (tone + 1) % TONES.length;
    setTone(next);
    try { window.localStorage.setItem(TONE_KEY, String(next)); } catch { /* storage unavailable */ }
  };

  const query = q.trim().toLowerCase();
  const cats = query
    ? [{ name: 'Results', icon: Search, items: ALL_EMOJI.filter(([, n]) => n.includes(query)) }]
    : [
        ...(recent.length ? [{ name: 'Recent', icon: History, items: recent.map((e) => [e, 'recent'] as [string, string]) }] : []),
        ...EMOJI_CATS,
      ];
  const iconResults = query ? ICON_NAMES.filter((n) => n.toLowerCase().includes(query)) : ICON_NAMES;

  // Bottom rail ↔ grid sync: clicking jumps to the section (instant, like the
  // benchmark — smooth scrolling is rAF-driven and dies in occluded tabs);
  // scrolling marks the section whose heading was last crossed. A short quiet
  // window keeps the jump's own scroll events from flickering the highlight.
  const railCats = cats.filter((c) => c.items.length > 0);
  const quietScrolls = useRef(0); // scroll events to ignore after a rail jump
  const scrollToCat = (name: string) => {
    setActiveCat(name);
    quietScrolls.current = 1; // the jump coalesces into one scroll event

    const sc = scrollRef.current, el = catRefs.current[name];
    // Recent may be absent (no history) — its rail button scrolls to the top.
    if (sc) sc.scrollTo({ top: el ? el.offsetTop : 0 });
  };
  const onGridScroll = () => {
    const sc = scrollRef.current;
    if (!sc) return;
    if (quietScrolls.current > 0) { quietScrolls.current -= 1; return; }
    let cur = railCats[0]?.name;
    for (const c of railCats) {
      const el = catRefs.current[c.name];
      if (el && el.offsetTop <= sc.scrollTop + 12) cur = c.name;
    }
    if (cur && cur !== activeCat) setActiveCat(cur);
  };

  async function intake(file: File) {
    setErr(null);
    try { onPick(await fileToDataUrl(file, { max: 180, square: true })); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
  }

  return (
    <PickerPanel label="Choose an icon" width={408} align={align} onClose={onClose}>
      <PickerTabs<Tab>
        tabs={[{ id: 'emoji', label: 'Emoji' }, { id: 'icons', label: 'Icons' }, { id: 'upload', label: 'Upload' }]}
        active={tab} onTab={(t) => { setTab(t); setErr(null); }}
        right={onRemove ? <PickerQuietAction label="Remove" onClick={() => { onRemove(); onClose(); }} /> : undefined}
      />
      {tab !== 'upload' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 12px' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 28, background: 'var(--paper-2)', borderRadius: 'var(--r-md)', padding: '0 8px', boxShadow: '0 0 0 1px var(--line)' }}>
            <Icon icon={Search} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'emoji' ? 'Search Emoji' : 'Search Icons'} autoComplete="off" data-1p-ignore data-lpignore="true"
              className="zb-picker-search"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-size)', lineHeight: '20px', color: 'var(--ink)', padding: 0 }} />
          </span>
          <button onClick={() => { const pick = tab === 'emoji' ? withTone(ALL_EMOJI[Math.floor(Math.random() * ALL_EMOJI.length)][0], TONES[tone]) : 'ph:' + ICON_NAMES[Math.floor(Math.random() * ICON_NAMES.length)]; onPick(pick); onClose(); }}
            title="Random" aria-label="Random icon" className="zb-press"
            style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--r-md)', border: 'none', boxShadow: '0 0 0 1px color-mix(in srgb, var(--ink) 20%, transparent)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Icon icon={Shuffle} size={16} />
          </button>
          {tab === 'emoji' && (
            <button onClick={cycleTone} title="Skin tone" aria-label="Cycle skin tone" className="zb-press"
              style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--r-md)', border: 'none', background: 'transparent', fontSize: 'var(--text-h3-size)', lineHeight: 1, cursor: 'pointer', padding: 0 }}>
              {withTone('✋', TONES[tone])}
            </button>
          )}
        </div>
      )}

      {tab === 'emoji' && (
        <>
          <div ref={scrollRef} onScroll={onGridScroll} style={{ position: 'relative', maxHeight: 262, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 12px 8px' }}>
            {cats.map((c) => c.items.length > 0 && (
              <div key={c.name} ref={(el) => { catRefs.current[c.name] = el; }}>
                <div style={catLabel}>{c.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
                  {c.items.map(([e, n], i) => (
                    <button key={c.name + e + i} title={n === 'recent' ? undefined : n} aria-label={n === 'recent' ? e : n} onClick={() => pickEmoji(e)} className="zb-press"
                      style={{ ...cell, fontSize: 'var(--text-stat-size)', lineHeight: 1 }}>
                      {n === 'recent' ? e : withTone(e, TONES[tone])}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {cats.every((c) => c.items.length === 0) && <div style={{ padding: '20px 4px', fontSize: 'var(--text-body-size)', color: 'var(--text-muted)', textAlign: 'center' }}>No emoji found</div>}
          </div>
          {/* Category rail — fixed set (Recent always leads, custom-upload plus
              trails), per the HiFi: a hairline separates it from the grid, and
              each icon carries a DS tooltip. Hidden while searching. */}
          {!query && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, padding: '0 12px', flexShrink: 0, borderTop: '1px solid var(--line)' }}>
              {[{ name: 'Recent', icon: History }, ...EMOJI_CATS.map((c) => ({ name: c.name, icon: c.icon }))].map((c) => {
                const on = activeCat === c.name;
                return (
                  <Tooltip key={c.name} content={c.name} side="bottom">
                    <button aria-label={`${c.name} emoji`} aria-pressed={on} onClick={() => scrollToCat(c.name)} className={on ? undefined : 'zb-press'}
                      style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-md)', border: 'none', background: on ? 'var(--hover)' : 'transparent', color: on ? 'var(--ink-2)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'background var(--duration-fast) var(--ease-hover), color var(--duration-fast) var(--ease-hover), transform var(--duration-fast) var(--ease-out-quiet)' }}>
                      <Icon icon={c.icon} size={20} />
                    </button>
                  </Tooltip>
                );
              })}
              {/* Trailing custom-emoji upload (per the HiFi's plus-square) */}
              <Tooltip content="Add emoji" side="bottom">
                <button aria-label="Add custom emoji" onClick={() => { setTab('upload'); setErr(null); }} className="zb-press"
                  style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-md)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Icon icon={SquarePlus} size={20} />
                </button>
              </Tooltip>
            </div>
          )}
        </>
      )}

      {tab === 'icons' && (
        <div style={{ maxHeight: 302, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 12px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {iconResults.map((n) => (
              <button key={n} title={n} aria-label={n} onClick={() => { onPick('ph:' + n); onClose(); }} className="zb-press"
                style={{ ...cell, color: 'var(--text-secondary)' }}>
                <Icon icon={PAGE_ICONS[n]} size={20} />
              </button>
            ))}
          </div>
          {iconResults.length === 0 && <div style={{ padding: '20px 4px', fontSize: 'var(--text-body-size)', color: 'var(--text-muted)', textAlign: 'center' }}>No icons found</div>}
        </div>
      )}

      {tab === 'upload' && (
        <div style={{ padding: '0 8px 8px' }}>
          <UploadZone hint="Recommended 280 × 280 px · max 8 MB" error={err} onFile={intake} />
        </div>
      )}
      <style>{`.zb-picker-search::placeholder{color:var(--disabled-text)}`}</style>
    </PickerPanel>
  );
}
