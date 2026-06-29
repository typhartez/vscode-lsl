// LSL script for testing undeclared variable detection

default
{
    state_entry()
    {
        // This should be flagged - undefinedVar is not declared
        llSay(0, undefinedVar);
    }
}