integer usedVar = 5;

integer unsetVar;
integer unusedVar = 6;
integer unreadVar;

integer incrementedVar = 0;

integer myFunc(integer unusedArg) {
    // TODO
}

default {
    state_entry() {
        llSay(0, (string)usedVar);
        string scopedUnusedVar = "fire";

        incrementedVar++;
        incrementedVar+=2;

        // if (incrementedVar > 0) {
        //
        // }
    }

    touch_start(integer num_detected)
    {
        unreadVar = 7;
    }
}