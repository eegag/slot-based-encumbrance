# slot-based-encumbrance

Created by eegag for use with the OSE system.

### installation

Install in FoundryVTT with the following URL:

https://github.com/eegag/slot-based-encumbrance/releases/download/v0.4.0/module.json

### features

Modifies the OSE Actor Sheet and OSE Item Sheet to display slot values instead of weight values.

Automatically assigns slot values to owned items.
- Tries to calculate slot values based on weight.
- Defaults to 1.

Calculates slots used by actor.
- Option to include or exclude equipped items from calculation.

Sets encumbered effects (movement speed = 0) based on exceeding slot maximum.
- Maximum defined in module settings.

Determines movement speed based on type of armor worn (as in Basic encumbrance).

Allows all types of items to be equipped (not just weapons and armor).

### settings

**MAXIMUM SLOTS METHOD** Choose how the module sets each actor's maximum number of inventory slots that they can fill before they become encumbered.
- *Use Base Value Only* The actor's maximum inventory slots are set to the base value assigned in module settings.
- *Add STR Mod to Base* The actor's STR modifier is added to the base value assigned in module settings to set the actor's maximum inventory slots.
- *Add CON Mod to Base* The actor's CON modifier is added to the base value assigned in module settings to set the actor's maximum inventory slots.
- *Use STR Score as Base* The actor's maximum inventory slots are set to the actor's STR ability score.
- *Use CON Score as Base* The actor's maximum inventory slots are set to the actor's CON ability score.

**BASE INVENTORY SLOT MAXIMUM** If not using an ability score as the maximum inventory slot value, input any number here to set an actor's slot maximum (carrying capacity).

**COINS PER SLOT** Enter how many coins (treasure: GP, SP, CP, etc.) is takes to equal 1 slot. Slot values are rounded up.
- *e.g.* If Coins Per Slot = 100 and the actor has 134 coins, then their coins will take up 2 slots.

**EXCLUDE EQUIPPED ITEMS?** Checking this box will tell the module to exclude any equipped items when totalling up an actor's filled slots.
- If a player tries to hold too many items (> 2 hands' worth), the module will notify them and set their speed to 0.
- If a players tries to wear multiple suits of armor, the module will alert them.