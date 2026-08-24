// Fixture: Firestorm preprocessor extensions that Tailslide does not understand
// but the LSP should suppress false-positive diagnostics for.
//
// 1. Lazy list indexing syntax (listVar[index])
list myList = ["a", "b"];
list other = [1, 2, 3];

default
{
    state_entry()
    {
        integer x = 1;

        // Lazy list indexing (Firestorm preprocessor extension)
        myList[2] = "c";
        other[0] = 42;
        llOwnerSay((string)myList[1]);
        llOwnerSay((string)other[2]);

        // Switch/case with block-style case labels (standard LSL, but Tailslide
        // doesn't fully understand the grammar)
        switch (x)
        {
            case 0:
            {
                llOwnerSay("zero");
                break;
            }
            case 1:
            {
                llOwnerSay("one");
                break;
            }
            default:
            {
                llOwnerSay("other");
                break;
            }
        }
    }
}