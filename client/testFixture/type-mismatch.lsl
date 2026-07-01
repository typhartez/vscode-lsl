// LSL script for testing type mismatch detection

integer myInteger = 42;
string myString = "hello";

default
{
    state_entry()
    {
        // This should be flagged - string passed where integer expected
        llSay(myString, "Hello");

        // This should NOT be flagged - integer is compatible with float
        llSleep(myInteger);
    }
}