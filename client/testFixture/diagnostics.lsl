// LSL script for testing diagnostics

// Test 1: Undeclared variable (should be flagged)
default
{
    state_entry()
    {
        llSay(0, undefinedVar);
    }
}