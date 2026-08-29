string goodGlobal;
DemoFunction()
{
	goodGlobal = "foo";
	problemGlobal = "bar";
}
string problemGlobal;
default
{
	state_entry()
	{
		DemoFunction();
		llOwnerSay(goodGlobal + problemGlobal);
	}
}