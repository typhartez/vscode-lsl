default
{
    state_entry()
    {
        llSay(0, "Hello, Avatar!")
        integer i = 5
        llOwnerSay((string)i)
    }

    touch_start(integer num_detected)
    {
        llSay(0, "Touched.")
    }
}