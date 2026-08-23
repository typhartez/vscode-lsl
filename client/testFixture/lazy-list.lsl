// Fixture: Firestorm lazy list indexing syntax (listVar[index])
// Tailslide does not understand this syntax, but the LSP should not
// report E10020 syntax errors for it.
list myList = ["a", "b"];
list other = [1, 2, 3];

default
{
    state_entry()
    {
        myList[2] = "c";
        other[0] = 42;
        llOwnerSay((string)myList[1]);
        llOwnerSay((string)other[2]);
    }
}