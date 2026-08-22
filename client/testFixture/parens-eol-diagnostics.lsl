default
{
    touch_start(integer num_detected)
    {
        if (
            (num_detected == 1)
        ) {
            llOwnerSay "oof"
            llOwnerSay("oof")
            llOwnerSay(
                ((string) 4)
            );
        }
    }
}