# slot-based-encumbrance

Created by eegag for use with the OSE system.

### installation

Install in FoundryVTT with the following URL:

https://github.com/eegag/slot-based-encumbrance/releases/download/v0.5.1/module.json

### features

Modifies the OSE Actor Sheet and OSE Item Sheet to display slot values instead of weight values.

Automatically assigns slot values to owned items.
- Tries to calculate slot values based on weight.
- Defaults to 1.

Calculates slots used by actor.
- Option to include or exclude equipped items from calculation.

Sets encumbered effects (movement speed = 0) based on exceeding slot maximum.
- Maximum defined in module settings.

Determines movement speed based on type of armor worn (as in Basic encumbrance) or number of filled slots (as in Detailed encumbrance).

Allows all types of items to be equipped (not just weapons and armor).

### settings

**MOVEMENT CALCULATION METHOD** Choose how the module calculates each actor's movement speed.
- *Basic* The actor's movement speed is determined by their equipped armor.
- *Detailed* The actor's movement speed is determined by how many slots they have filled.
- If a player tries to carry more items in their inventory than their slot maximum, the module will flag them as encumbered and set their speed to 0 regardless of the Movement Calculation Method.

**CONFIGURE DETAILED MOVEMENT** If the Movement Calculation Method is *Detailed*, use this form to set the paramaters for each speed threshold
- *e.g.* To mirror Detailed encumbrance from OSE Classic Fantasy, input "Up to 4 slots for 120' Mv", "Up to 6 slots for 90' Mv", and "Up to 8 slots for 60' Mv".

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

**SHOW NOTIFICATIONS?** Checking this box will enable UI notifications to the players in the following scenarios:
- If a player tries to carry too many items (> slot maximum)
- If a player tries to hold too many items (> 2 hands' worth)
- If a player tries to wear multiple suits of armor