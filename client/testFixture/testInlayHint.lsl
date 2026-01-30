default
{
    state_entry()
    {
        llRezObject("deck", <position.x + deckOffsetX, position.y, position.z + 0.09>, ZERO_VECTOR, ZERO_ROTATION, 0);
    }
}