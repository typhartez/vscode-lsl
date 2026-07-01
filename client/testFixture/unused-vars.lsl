integer usedVar = 5;

integer unsetVar;
integer unusedVar = 6;
integer unreadVar;

integer incrementedVariable = 0;

integer myFunc(integer unusedArg) {
    // TODO
}

myOtherFunc() {
    // TODO
}

string usedFunc() {
    return "we're no strangers to love";
}

default {
    state_entry() {
        llSay(0, (string)usedVar);
        string scopedUnusedVar = "fire";

        incrementedVariable++;
        incrementedVariable+=2;

        // if (incrementedVar > 0) {
        //
        // }
    }

    touch_start(integer num_detected)
    {
        unreadVar = 7;

        llShout(1, usedFunc());
    }
}