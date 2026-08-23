// ColorPicker 2.0 (2018-2026 by Typhaine Artez)
//
// Provided under Creative Commons Attribution-Non-Commercial-ShareAlike 4.0 International license.
// Please be sure you read and adhere to the terms of this license: https://creativecommons.org/licenses/by-nc-sa/4.0/
//
//
//  Made with love, wanting the optimal color picker, one mesh object, optimized script, self contained.
//  Thanks to Cheetos Brat for the face params work on the mesh object
//  Slider texture offset idea borrowed Chimera Firecaster (and by her Nova Convair)
//  HSV/RGB conversion functions adapted from Sally LaSalle (http://wiki.secondlife.com/wiki/Color_conversion_scripts)
//
// Usage:
//  1) link the picker to your build (hud)
//  2) communicate with it through link messages
//  3) that's all :)
//
// The picket accepts in input only setting some options that you can group in one message if you want
// (separate options with a ~):
//  llMessageLinked(link_number_of_picker, 0, options, (key)"ColorPicker");
// options can be:
//  mode="SV_H" (default) or mode="HS_V"
//      changes how the picker uses the main picker palette and slider bar
//      in SV_H palette is a saturation/value gradient and bar is a hue slider
//      in HS_V palette is a hue/saturation gradient and bar is a value slider`
//  rgb=<RGB vector>
//      send a new (or initial) color by its RGB components (LSL vector format)
//  hsv=<HSV vector>
//      send a new (or initial) color by its HSV components (LSL vector format)
//  public=1 or 0 (0 by default)
//      allow anyone to manipulate the picket when rezzed on a region
//  selectOnly=1 or 0 (0 by default)
//      picket sends a message only when a color is selected (not while dragging)
//  sendHSV=1 or 0 (0 by default)
//      asks the color sent by the picket to be in HSV format (RGB by default)
//  sendTo=linknumber or -1 (-1 by default - all links)
//      asks the picket to send messages to a specific link, or all links in the linkset
//  preview=linknumber,face
//      tells the picker to update that link on that face during color selection
// i.e.
//  llMessageLinked(pickerLink, 0, "rgb=<1,1,1>", (key)"ColorPicker");
// or
//  llMessageLinked(pickerLink, 0, "mode=HS_V~rgb=<1,1,1>~sendHSV=1~selectOnly=1", (key)"ColorPicker");
//
// The picker will send messages to the asked link (sendTo option) or all links.
// The key part will always be "ColorPicker" (as asked in input)
// The number tells the reason of the message:
//  1   user is dragging the cursors and selectOnly=FALSE
//  2   user selected a color (end of drag or just touched)
//  3   user requested the current color
// To request a color from the picker, send a message with -1 in the number.

#define IDENTIFIER      "ColorPicker"

// faces definitions
#define MAIN_BASE       0
#define MAIN_GRADIENT   1
#define MAIN_PICKER     2
#define BAR_BASE        3
#define BAR_GRADIENT    4
#define BAR_SLIDER      5

// messages
#define MSG_OPTIONS     0
#define MSG_REQUEST     -1
#define MSG_DRAGGING    1
#define MSG_SELECT      2
#define MSG_VALUE       3
#define MSG_RESET       -10

#define MODE_SV_H       FALSE   // saturation/value on palette, hue on bar
#define MODE_HS_V       TRUE    // hue/saturation on palette, value on bar

float UPDATE_PER_SECOND = 50;

integer mode = MODE_SV_H;       // sat/value and hue, or hue/sat and value
integer ownerOnly = TRUE;       // only user can touch and use
integer selectOnly = FALSE;     // send the color only when the user releases the cursor
integer sendHSV = FALSE;        // send resulting color in HSV instead of RGB
integer sendTo = LINK_ALL_OTHERS;   // send to?
list preview;                   // {link, face} where to update color

key toucher = NULL_KEY;
integer touchedPart = 0;


vector HSV = <0.5,0.5,0.5>;
vector coordPre = <1.0, 1.0, 1.0>;  // last coordinates position

#define DBG(_msg)       llOwnerSay(_msg)

vector hsv2rgb(vector hsv) {
    // hue
    float h = hsv.x;
    if (h < 0.0) h = 0.0;
    else if (h >= 1.0) h = 6.0;
    else h *= 6.0; // range 0 to 5 (for the 6 division of the chromatic circle)

    //saturation
    float s = hsv.y;
    if (s < 0.0) s = 0.0;
    else if (s > 1.0) s = 1.0;

    // value
    float v = hsv.z;
    if (v < 0.0) v = 0.0;
    else if (v > 1.0) v = 1.0;

    // achromatic (grey)
    if (s == 0.0) return <v, v, v>;

    integer i = llFloor(h);
    float f = h - i;   // factorial part of hue
    float p = v * (1.0 - s);
    float q = v * (1.0 - s * f);
    float t = v * (1.0 - s * (1.0 -f));

    if (i == 0) return <v, t, p>;
    if (i == 1) return <q, v, p>;
    if (i == 2) return <p, v, t>;
    if (i == 3) return <p, q, v>;
    if (i == 4) return <t, p, v>;
    /* i == 5 */return <v, p, q>;
}

vector rgb2hsv(vector rgb) {
    // red
    float r = rgb.x;
    if (r < 0.0) r = 0.0;
    else if (r > 1.0) r = 1.0;

    // green
    float g = rgb.y;
    if (g < 0.0) g = 0.0;
    else if (g > 1.0) g = 1.0;

    // blue
    float b = rgb.z;
    if (b < 0.0) b = 0.0;
    else if (b > 1.0) b = 1.0;

    float min = llListStatistics(LIST_STAT_MIN, [r,g,b]);
    float max = llListStatistics(LIST_STAT_MAX, [r,g,b]);

    float h; float s;
    float v = max;
    if (max == 0.0) return ZERO_VECTOR; // value=0=black

    float d = max - min; // delta
    s = d / max;

    if (r == g && g == b) h = 0; // achromatic
    else if (r == max) h = 0 + (g - b) / d; // between red and yellow
    else if (g == max) h = 2 + (b - r) / d; // between yellowand cyan
    else               h = 4 + (r - g) / d; // between cyan & red

    h /= 6.0;   // 0..1
    if (h < 0.0) h += 1.0;   // roll one round

    return <h, s, v>;
}

// uses link or face numbers
integer getTouchedPart() {
    return llDetectedTouchFace(0);
}

setMode(integer newMode) {
    string tex = llGetInventoryKey("ColorPickerTex");
    string pick = llGetInventoryKey("PickerCrossTex");
    vector offset = ZERO_VECTOR;
    if (newMode) offset = <0.5, -0.125, 0.0>;
    llSetLinkPrimitiveParamsFast(LINK_THIS, [
        PRIM_TEXTURE, MAIN_BASE, TEXTURE_BLANK, <1.0, 1.0, 0.0>, ZERO_VECTOR, 0.0,
        PRIM_TEXTURE, MAIN_GRADIENT, tex, <1.0, 1.0, 0.0>, <offset.x, 0.0, 0.0>, 0.0,
        PRIM_TEXTURE, MAIN_PICKER, pick, <1.0, 1.0, 0.0>, <offset.x, 0.0, 0.0>, 0.0,
        PRIM_TEXTURE, BAR_BASE, TEXTURE_BLANK, <1.0, 1.0, 0.0>, ZERO_VECTOR, 0.0,
        PRIM_TEXTURE, BAR_GRADIENT, tex, <1.0, 1.0, 0.0>, <0.0, offset.y, 0.0>, 0.0,
        PRIM_TEXTURE, BAR_SLIDER, tex, <1.0, 1.0, 0.0>, <0.0, offset.y, 0.0>, 0.0
    ]);
    mode = newMode;
}

setHSV(integer part, vector coord) {
    if (MODE_SV_H == mode) {
        if (BAR_SLIDER == part) HSV.x = coord.x;
        else if (MAIN_PICKER == part) HSV = <HSV.x, coord.x, coord.y>;
    }
    else {
        if (BAR_SLIDER == part) HSV.z = coord.x;
        else if (MAIN_PICKER == part) HSV = <coord.x, coord.y, HSV.z>;
    }
    updateUI(part);
}

updateUI(integer part) {
    list pp;
    float x; float y;
    if (0 == part || BAR_SLIDER == part) {
        if (MODE_SV_H == mode) x = 1.0 - HSV.x;
        else x = 1 - HSV.z;
        pp = [PRIM_TEXTURE, BAR_SLIDER] + llListReplaceList(llGetPrimitiveParams(
            [PRIM_TEXTURE, BAR_SLIDER]), [<0.98, 1.0, 0.0>, <x, 0.0, 0.0>], 1, 2);
    }
    if (0 == part || MAIN_PICKER == part) {
        if (MODE_SV_H == mode) { x = HSV.y; y = HSV.z; }
        else { x = HSV.x; y = HSV.y; }
        pp += [PRIM_TEXTURE, MAIN_PICKER] + llListReplaceList(llGetPrimitiveParams(
            [PRIM_TEXTURE, MAIN_PICKER]), [<0.98, 0.98, 0.0>, <0.5 - x, 0.5 - y, 0.0>], 1, 2);
    }
    vector hue = hsv2rgb(<HSV.x, 1.0, 1.0>);
    pp += [
        PRIM_COLOR, MAIN_BASE, hue, 1.0,
        PRIM_COLOR, BAR_BASE, hue, 1.0
    ];
    if (llGetListLength(preview)) pp += [
        PRIM_LINK_TARGET, llList2Integer(preview, 0),
        PRIM_COLOR, llList2Integer(preview, 1), hsv2rgb(HSV), 1.0
    ];
    llSetLinkPrimitiveParamsFast(LINK_THIS, pp);
}

sendColor(integer reason) {
    vector col = HSV;
    vector rgb = hsv2rgb(col);
    if (!sendHSV) col = rgb;
    if ([] != preview) llSetLinkPrimitiveParamsFast(llList2Integer(preview, 0),
            [PRIM_COLOR, llList2Integer(preview, 1), rgb, 1.0]);
    if (MSG_DRAGGING == reason && selectOnly) return;
    llMessageLinked(sendTo, reason, (string)col, IDENTIFIER);
}

vector normedCoords(integer part) {
    vector v = llDetectedTouchST(0);
    if (BAR_SLIDER == part) {
        v.x = v.x * 0.98 + 0.02;
        if (v.x < 0.025) v.x = 0.02;
    }
    else {
        if (v.x < 0.01) v.x = 0.0;
        else if (v.x > 0.99) v.x = 1.0;
        if (v.y < 0.01) v.y = 0.0;
        else if (v.y > 0.99) v.y = 1.0;
    }
    return v;
}

default {
    state_entry() {
        setMode(mode);
        updateUI(0);
        sendColor(MSG_RESET);
    }
    link_message(integer sender, integer n, string str, key id) {
        if (LINK_THIS == sender ||IDENTIFIER != (string)id) return;
        if (MSG_OPTIONS == n) {
            // set options
            list p = llParseString2List(str, ["~", "="], []);
            n = llGetListLength(p);
            while (-1 < (n -= 2)) {
                str = llList2String(p, n);
                string val = llList2String(p, n+1);
                if ("rgb" == str) HSV = rgb2hsv((vector)val);
                else if ("hsv" == str) HSV = (vector)val;
                else if ("public" == str) ownerOnly = (integer)("0" == val);
                else if ("selectOnly" == str) selectOnly = (integer)("1" == val);
                else if ("sendHSV" == str) sendHSV = (integer)("1" == val);
                else if ("sliderColor" == str) llSetColor((vector)val, BAR_SLIDER);
                else if ("sendTo" == str) {
                    integer to = (integer)val;
                    if (0 < to) sendTo = to;
                    else sendTo = LINK_ALL_OTHERS;
                }
                else if ("mode" == str) {
                    str = llList2String(p, n+1);
                    integer new = llListFindList(["SV_H", "HS_V"], val);
                    if (~new) setMode(new);
                }
                else if ("preview" == str) {
                    list l = llParseString2List(val, [","], []);
                    if (2 == llGetListLength(l)) preview = [
                        (integer)llList2String(l, 0),
                        (integer)llList2String(l, 1)
                    ];
                }
            }
            updateUI(0);
        }
        else if (MSG_REQUEST == n) {
            sendColor(MSG_VALUE);
        }
    }
    touch_start(integer n) {
        if (llDetectedKey(0) != llGetOwner() && TRUE == ownerOnly) return;
        if (NULL_KEY == toucher || 0.25 < llGetTime()) {
            integer part = getTouchedPart();
            toucher = llDetectedKey(0);
            touchedPart = part;
            if (MAIN_PICKER == part || BAR_SLIDER == part) {
                coordPre = normedCoords(part);
                setHSV(part, coordPre);
            }
        }
    }
    touch(integer n) {
        if (llDetectedKey(0) == toucher && (1.0 / UPDATE_PER_SECOND) < llGetTime()) {
            integer part = getTouchedPart();
            vector coord = normedCoords(part);
            if (coord == coordPre) return; // no move

            if (touchedPart == part && TOUCH_INVALID_TEXCOORD != coord) {
                coordPre = coord;
            }
            else {
                coord = coordPre;
                part = touchedPart;
            }
            setHSV(part, coord);
            sendColor(MSG_DRAGGING);
        }
    }
    touch_end(integer n) {
        if (llDetectedKey(0) == toucher) {
            integer part = getTouchedPart();
            vector coord = normedCoords(part);
            sendColor(MSG_SELECT);
        }
        toucher = NULL_KEY;
    }
}
