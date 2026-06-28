const paramSpecs: Record<string, string[]> = {
    PRIM_ALLOW_UNSIT: ["allow"],
    PRIM_ALPHA_MODE: ["face", "alpha_mode", "alpha_cutoff"],
    PRIM_BUMP_SHINY: ["face", "shiny", "bump"],
    PRIM_CAST_SHADOWS: ["cast"],
    PRIM_CLICK_ACTION: ["action"],
    PRIM_COLOR: ["face", "color", "alpha"],
    PRIM_DESC: ["description"],
    PRIM_FLEXIBLE: ["play", "tension", "gravity", "friction", "wind", "tension", "force"],
    PRIM_FULLBRIGHT: ["face", "fullbright"],
    PRIM_GLOW: ["face", "glow"],
    PRIM_GLTF_BASE_COLOR: ["face", "texture", "scale", "offset", "rotation_in_radians", "color_tint", "alpha_tint", "alpha_mode", "alpha_cutoff", "double_sided"],
    PRIM_GLTF_EMISSIVE: ["face", "texture", "scale", "offset", "rotation_in_radians", "emissive_tint"],
    PRIM_GLTF_METALLIC_ROUGHNESS: ["face", "texture", "scale", "offset", "rotation_in_radians", "metallic_factor", "roughness_factor"],
    PRIM_GLTF_NORMAL: ["face", "texture", "scale", "offset", "rotation_in_radians"],
    PRIM_LINK_TARGET: ["link"],
    PRIM_MATERIAL: ["material"],
    PRIM_MEDIA_ALT_IMAGE_ENABLE: ["face", "enable"],
    PRIM_MEDIA_CONTROLS: ["face", "controls"],
    PRIM_MEDIA_CURRENT_URL: ["face", "url"],
    PRIM_MEDIA_HOME_URL: ["face", "url"],
    PRIM_MEDIA_AUTO_LOOP: ["face", "loop"],
    PRIM_MEDIA_AUTO_PLAY: ["face", "play"],
    PRIM_MEDIA_AUTO_SCALE: ["face", "scale"],
    PRIM_MEDIA_AUTO_ZOOM: ["face", "zoom"],
    PRIM_MEDIA_FIRST_CLICK_INTERACT: ["face", "interact"],
    PRIM_MEDIA_ILLUMINATION: ["face", "illumination"],
    PRIM_MEDIA_WIDTH_PIXELS: ["face", "width"],
    PRIM_MEDIA_HEIGHT_PIXELS: ["face", "height"],
    PRIM_MEDIA_WHITELIST_ENABLE: ["face", "enable"],
    PRIM_MEDIA_WHITELIST: ["face", "whitelist"],
    PRIM_MEDIA_PERMS_INTERACT: ["face", "perms"],
    PRIM_MEDIA_PERMS_CONTROL: ["face", "perms"],
    PRIM_NAME: ["name"],
    PRIM_NORMAL: ["face", "texture", "repeats", "offsets", "rotation_in_radians"],
    PRIM_OMEGA: ["axis", "spinrate", "gain"],
    PRIM_PHANTOM: ["phantom"],
    PRIM_PHYSICS: ["physics"],
    PRIM_PHYSICS_SHAPE_TYPE: ["physics_shape_type"],
    PRIM_POINT_LIGHT: ["play", "color", "intensity", "radius", "falloff"],
    PRIM_POSITION: ["position"],
    PRIM_POS_LOCAL: ["position"],
    PRIM_PROJECTOR: ["texture", "fov", "focus", "ambience"],
    PRIM_REFLECTION_PROBE: ["ambience", "clip_distance"],
    PRIM_RENDER_MATERIAL: ["face", "material"],
    PRIM_ROTATION: ["rotation"],
    PRIM_ROT_LOCAL: ["rotation"],
    PRIM_SCRIPTED_SIT_ONLY: ["scripted_only"],
    PRIM_SIT_TARGET: ["active", "offset", "rot"],
    PRIM_SIZE: ["size"],
    PRIM_SLICE: ["slice"],
    PRIM_SPECULAR: ["face", "texture", "repeats", "offsets", "rotation_in_radians", "color", "glossiness", "environment"],
    PRIM_TEMP_ON_REZ: ["temp"],
    PRIM_TEXGEN: ["face", "type"],
    PRIM_TEXT: ["text", "color", "alpha"],
    PRIM_TEXTURE: ["face", "texture", "repeats", "offsets", "rotation_in_radians"]
};

const tokenize = (input: string): string[] => {
    let content = input.trim();
    if (content.startsWith('[')) content = content.substring(1);
    if (content.endsWith(']')) content = content.substring(0, content.length - 1);
    
    const tokens: string[] = [];
    let currentToken = '';
    let inVectorOrRotation = 0;
    let inParen = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (inString) {
            currentToken += char;
            if (char === '\n') {
                inString = false;
                escape = false;
            } else if (escape) {
                escape = false;
            } else if (char === '\\') {
                escape = true;
            } else if (char === '"') {
                inString = false;
            }
        } else if (char === '"') {
            inString = true;
            currentToken += char;
        } else if (char === '<') {
            inVectorOrRotation++;
            currentToken += char;
        } else if (char === '>') {
            if (inVectorOrRotation > 0) inVectorOrRotation--;
            currentToken += char;
        } else if (char === '(') {
            inParen++;
            currentToken += char;
        } else if (char === ')') {
            if (inParen > 0) inParen--;
            currentToken += char;
        } else if (char === ',' && inVectorOrRotation === 0 && inParen === 0) {
            tokens.push(currentToken.trim());
            currentToken = '';
        } else {
            currentToken += char;
        }
    }
    if (currentToken.trim()) {
        tokens.push(currentToken.trim());
    }
    return tokens;
};

const primParamsStateMachine = (primParams: string): string[] => {
    const tokens = tokenize(primParams);
    const result: string[] = [];
    
    let state = 'param';
    let expectedArgs: string[] = [];
    let currentArgIndex = 0;

    for (const token of tokens) {
        if (state === 'param') {
            result.push('param');
            const paramType = token;
            if (paramSpecs[paramType]) {
                expectedArgs = paramSpecs[paramType];
                currentArgIndex = 0;
                state = 'args';
            } else if (paramType === 'PRIM_TYPE') {
                expectedArgs = ['flag'];
                currentArgIndex = 0;
                state = 'args';
            } else {
                expectedArgs = [];
                state = 'param';
            }
        } else if (state === 'args') {
            if (currentArgIndex < expectedArgs.length) {
                const expected = expectedArgs[currentArgIndex];
                result.push(expected);
                
                if (expected === 'flag') {
                    if (token === 'PRIM_TYPE_BOX' || token === 'PRIM_TYPE_CYLINDER' || token === 'PRIM_TYPE_PRISM') {
                        expectedArgs = expectedArgs.concat(['hole_shape', 'cut', 'hollow', 'twist', 'top_size', 'top_shear']);
                    } else if (token === 'PRIM_TYPE_SPHERE') {
                        expectedArgs = expectedArgs.concat(['hole_shape', 'cut', 'hollow', 'twist', 'dimple']);
                    } else if (token === 'PRIM_TYPE_TORUS' || token === 'PRIM_TYPE_TUBE' || token === 'PRIM_TYPE_RING') {
                        expectedArgs = expectedArgs.concat(['hole_shape', 'cut', 'hollow', 'twist', 'hole_size', 'top_shear', 'advanced_cut', 'taper', 'revolutions', 'radius_offset', 'skew']);
                    } else if (token === 'PRIM_TYPE_SCULPT') {
                        expectedArgs = expectedArgs.concat(['map', 'type']);
                    }
                }
                
                currentArgIndex++;
                if (currentArgIndex >= expectedArgs.length) {
                    state = 'param';
                }
            } else {
                result.push('unknown');
            }
        }
    }
    
    return result;
};

export default primParamsStateMachine;
