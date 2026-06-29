default
{
    state_entry()
    {
        llRezObject("deck", <position.x + deckOffsetX, position.y, position.z + 0.09>, ZERO_VECTOR, ZERO_ROTATION, 0);

        llSetLinkPrimitiveParamsFast(LINK_THIS, [


            PRIM_NAME, "Hello",
            PRIM_SIT_TARGET, FALSE, ZERO_VECTOR, <0, 0, 0, 1>,
            PRIM_GLOW, ALL_SIDES, 0.9
        ]);
    }
}