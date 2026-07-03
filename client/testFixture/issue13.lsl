integer currentLevel = 1;
string currentContext = "Main";
string currentData = "";
integer INPUT_CHANNEL = -1;

handleMenuInput(string message) {
    if (message == "Add region")
    {
        vector pos = llGetPos();
        currentData = "REGION;"+llGetRegionName()+";"+(string)(pos.x)+";"+(string)(pos.y)+";"+(string)(pos.z)+";_;_;";
        currentData = "REGION;"+llGetRegionName()+";"+(string)pos.x+";"+(string)pos.y+";"+(string)pos.z+";_;_;";
        currentLevel = 3;
        currentContext = "Name";
        llTextBox(llGetOwner(), "Give it a name:", INPUT_CHANNEL);
    }
}

default
{
    on_rez(integer iNum){
    }
    changed(integer change)
    {
        if (change & CHANGED_OWNER) // Check if the owner has changed
            llResetScript(); // Optional: Reset script to reinitialize for the new owner
    }
}