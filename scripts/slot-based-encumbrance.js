/**
 * Core constants and logic for slot-based-encumbrance
 */
class SbeCore {
	static ID = 'slot-based-encumbrance';

/**
	 * A small helper function which leverages developer mode flags to gate debug logs.
	 * 
	 * @param {boolean} force - forces the log even if the debug flag is not on
	 * @param  {...any} args - what to log
	 */
	static log(force, ...args) {  
	const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

		if (shouldLog) {
			console.log(this.ID, '|', ...args);
		}
	}
}

/**
 * Class to modify the OSE item sheet
 */
class UpdateItemSheet {
  static async addSlotFields(app, html, data) {

	 /**
		* Add a slots field to the item card
		* Replacing the weight field
		*/
		const slotsLabel = game.i18n.localize("SLOT-BASED-ENCUMBRANCE.labels.SlotsField");
		
		if (data.type == "weapon") {

			// Slot field html literal
			const weaponSlotField = `
						<label title="${slotsLabel}"><i class="fas fa-weight-hanging"></i></label>
            <div class="form-fields">
              <input type="text" name="data.slots" value="${data.data.slots}" data-dtype="Number" />
            </div>`;
					
			// Finds the details section and the weight field
			const windowDetails = document.getElementsByClassName("details");
			const detailsLast = windowDetails[0].lastElementChild;

			// Replace the weight field with the slots field
			detailsLast.innerHTML = weaponSlotField;
		} else {

			// Slot field html literal
			const slotInputField = `
						<label>${slotsLabel}</label>
						<div class="form-fields">
							<input type="text" name="data.slots" value="${data.data.slots}" data-dtype="Number" />
						</div>`;
					
			// Finds the details section and the weight field
			const windowStats = document.getElementsByClassName("stats");
			const statsLast = windowStats[0].lastElementChild;

			// Replace the weight field with the slots field
			statsLast.innerHTML = slotInputField;
		}
  }
}

/**
 * Function to extend the OseActorSheetCharacter class during ready hook
 * to overwrite system default character sheet
 */
function loadActorSheetCharacter(superclass) {
	class SbeActorSheetCharacter extends superclass {
		constructor(...args) {
    super(...args);
		}

		/**
		 * Extend and override the default options used by the OSE Actor Sheet
		 * @returns {Object}
		 */
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				template: `modules/slot-based-encumbrance/templates/character-sheet.html`,
			});
		}
	}
	
	return SbeActorSheetCharacter;
}

/**
 * Function to extend the OseItem class during init hook
 * to add totalSlots property
 */
function sbeActor(superclass) {
	return class extends superclass {

		prepareData() {
		super.prepareData();
		this.computeInventorySlots();
		}

	  /**
	   * Function to calculate the actor's slot maximum and currently filled slots
	   * Then calls function to determine movement speed
	   */
		computeInventorySlots() {
			if (this.data.type != "character") {
				return;
			}
			
			const data = this.data.data;
			const countEquipped = game.settings.get("slot-based-encumbrance", "countEquipped");
			
			// Compute encumbrance
			const items = [...this.data.items.values()];
			let heldItems = 0;
			let wornArmor = 0;
			let totalWeight = items.reduce((acc, item) => {
				
				// Equipped containers don't count, but track how many hands you need
				if (countEquipped && item.type == "container" && item.data.data.equipped) {
					heldItems = item.data.data.totalSlots > 4 ? heldItems + 2 : heldItems + 1;
					return acc + item.data.data.slots - item.data.data.totalSlots;
				// Don't double count containers and their contents
				} else if (item.type == "container") {
					return acc + item.data.data.slots;
				// Equipped armor doesn't count either
				} else if (countEquipped && item.data.data.containerId == "" && item.data.data.equipped && item.type == "armor" && item.data.data.type != "shield") {
					wornArmor++;
					return acc;
				// Other equipped items don't count either, but track how many hands you need
				}	else if (countEquipped && item.data.data.containerId == "" && item.data.data.equipped) {
					heldItems = heldItems + item.data.data.slots;
					return acc;
				} else {
					return acc + item.data.data.totalSlots;
				}
			}, 0);

			// If you tried to wear multiple suits of armor, annoy you with a message
			if (game.ready && wornArmor > 1 && this.isOwner && !game.user.isGM) {
				ui.notifications.error(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.TooMuchArmorMessage")
					);
			}

			// If you tried to hold too many items, annoy you with a message
			if (game.ready && heldItems > 2 && this.isOwner && !game.user.isGM) {
				ui.notifications.warn(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.TooManyHeldItemsMessage")
					);
			}

			let max = 0;
			
			// Set individual actor slot maximum
			if (game.settings.get("slot-based-encumbrance", "determineSlots") == "strscore") {
				max = data.scores.str.value;
			} else if (game.settings.get("slot-based-encumbrance", "determineSlots") == "conscore") {
				max = data.scores.con.value;
			} else {
				max = game.settings.get("slot-based-encumbrance", "baseSlots");
			}
						
			// Add STR or CON bonus if enabled
			if (game.settings.get("slot-based-encumbrance", "determineSlots") == "strbonus") {
				max += data.scores.str.mod;
			} else if (game.settings.get("slot-based-encumbrance", "determineSlots") == "conbonus") {
				max += data.scores.con.mod;
			}

			data.inventory = {
				pct: Math.clamped((100 * parseFloat(totalWeight)) / max, 0, 100),
				max: max,
				encumbered: totalWeight > max || heldItems > 2,
				value: totalWeight,
			};

			this.calculateMovementSpeed();
		}

		calculateMovementSpeed() {
			const data = this.data.data;
			const weight = data.inventory.value;

			const armors = this.data.items.filter((i) => i.type === "armor");
			let heaviest = 0;
			armors.forEach((a) => {
				const armorData = a.data.data;
				const weight = armorData.type;
				const equipped = armorData.equipped;
				if (equipped) {
					if (weight === "light" && heaviest === 0) {
						heaviest = 1;
					} else if (weight === "heavy") {
						heaviest = 2;
					}
				}
			});
			switch (heaviest) {
				case 0:
					data.movement.base = 120;
					break;
				case 1:
					data.movement.base = 90;
					break;
				case 2:
					data.movement.base = 60;
					break;
			}
			if (data.inventory.encumbered) {
				data.movement.base = 0;
				if (game.ready && this.isOwner && !game.user.isGM) {
					ui.notifications.warn(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.EncumberedWarningMessage")
					);
				}
			}
		}
	};
}

/**
 * Function to extend the OseItem class during init hook
 * to add totalSlots property
 */
function sbeItem(superclass) {
	return class extends superclass {

		prepareData() {
		super.prepareData();
		}

		prepareDerivedData() {
		super.prepareDerivedData();
		this.data.data.slots = this.createSlotValue();
		this.data.data.totalSlots = this.createTotalSlots();
		}

		/** 
		* If no slot value exists, set a value based on item type and weight.
		* Default to 1 if no weight exists.
		*/
		createSlotValue() {
			const coinsPerSlot = game.settings.get("slot-based-encumbrance", "coinsPerSlot");

			if (this.data.data.slots == null || this.data.data.slots == undefined) {
				if (!this.data.data.weight) {
					return 1;
				}	else if (this.data.type == "armor" && this.data.data.type != "shield") {
					return Math.floor(this.data.data.weight/200);
				} else if (this.data.type == "treasure") {
					return Math.ceil(this.data.data.cost/coinsPerSlot);
				} else {
					return Math.ceil(this.data.data.weight/100);
				}
			// Reset empty containers
			} else if (this.data.type == "container" && this.data.data.slots == 0) {
				return 1;
			} else {
				return this.data.data.slots;
			}
		}

		/**
		 * Create a totalSlots value
		 * Check for container with contents
		 * Check for bundled items
		 */
		createTotalSlots() {
			if (this.data.data.slots === undefined) {
				return;
			}
			
			const coinsPerSlot = game.settings.get("slot-based-encumbrance", "coinsPerSlot");
			
			//Container totalSlots calculation (with embedded totalSlots math to recalc item totals)
			if (this.type == "container" && game.ready && this.actor) {

				const actorItems = this.actor.data.items._source;
				const containerID = this.data._id;
				let slotTotal = 0;

				for (let i = 0; i < actorItems.length; i++) {
					if (actorItems[i].data.containerId == containerID) {
						let totalSlots;
						if (actorItems[i].data.treasure) {
							totalSlots = Math.ceil(actorItems[i].data.quantity.value/coinsPerSlot);
						}	else if (!actorItems[i].data.quantity.max) {
							totalSlots = actorItems[i].data.slots * actorItems[i].data.quantity.value;
						} else {
							totalSlots = Math.ceil(actorItems[i].data.quantity.value/actorItems[i].data.quantity.max);
						}
						
						slotTotal = slotTotal + totalSlots;
					}
				}
				
				if (slotTotal === 0) {
					slotTotal = this.data.data.slots;
				} else {
					this.data.data.slots = 0;
				}
				return slotTotal;

			//Standard totalSlots calculation
			} else {				
				if (this.data.data.treasure) {
					return Math.ceil(this.data.data.quantity.value/coinsPerSlot);
				} else if (!this.data.data.quantity.max) {
					return this.data.data.slots * this.data.data.quantity.value;
				} else {
					return Math.ceil(this.data.data.quantity.value/this.data.data.quantity.max);
				}
			}
		}
	};
}

/**
 * Function to add slot-based encumbrance options to OSE system settings
 * Overrides other encumbrance options with slot-based encumbrance
 */
const registerSettings = function() {
	game.settings.register("ose", "encumbranceOption", {
    name: game.i18n.localize("OSE.Setting.Encumbrance"),
    hint: game.i18n.localize("OSE.Setting.EncumbranceHint"),
    default: "slotbased",
    scope: "world",
    type: String,
    config: true,
    choices: {
			slotbased: "SLOT-BASED-ENCUMBRANCE.settings.EncumbranceSlotBased",
    },
  });
	
  game.settings.register("ose", "significantTreasure", {
    name: game.i18n.localize("OSE.Setting.SignificantTreasure"),
    hint: game.i18n.localize("OSE.Setting.SignificantTreasureHint"),
    default: 800,
    scope: "world",
    type: Number,
    config: false,
  });

  game.settings.register("slot-based-encumbrance", "determineSlots", {
    name: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.DetermineSlots"),
    hint: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.DetermineSlotsHint"),
    default: "baseonly",
    scope: "world",
    type: String,
    config: true,
    choices: {
			baseonly: "SLOT-BASED-ENCUMBRANCE.settings.BaseValueOnly",
			strscore: "SLOT-BASED-ENCUMBRANCE.settings.StrAsBase",
			conscore: "SLOT-BASED-ENCUMBRANCE.settings.ConAsBase",
			strbonus: "SLOT-BASED-ENCUMBRANCE.settings.StrToBase",
			conbonus: "SLOT-BASED-ENCUMBRANCE.settings.ConToBase",
    },
  });

  game.settings.register("slot-based-encumbrance", "baseSlots", {
    name: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.BaseSlotValue"),
    hint: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.BaseSlotValueHint"),
    default: 10,
    scope: "world",
    type: Number,
    config: true,
  });
	
  game.settings.register("slot-based-encumbrance", "coinsPerSlot", {
    name: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.CoinsPerSlot"),
    hint: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.CoinsPerSlotHint"),
    default: 100,
    scope: "world",
    type: Number,
    config: true,
  });
	
	  game.settings.register("slot-based-encumbrance", "countEquipped", {
    name: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.CountEquipped"),
    hint: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.CountEquippedHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });
}

const preloadHandlebarsTemplates = async function () {
  const templatePaths = [
    //Character Sheet
    `modules/slot-based-encumbrance/templates/character-sheet.html`,

    //Character Sheet Partials
    `modules/slot-based-encumbrance/templates/partials/character-inventory-tab.html`,
  ];
  return loadTemplates(templatePaths);
};

/**
 * Render ItemSheet Hook
 */
Hooks.on("renderItemSheet", (app, html, data) => {
	UpdateItemSheet.addSlotFields(app, html, data);
});

/**
 * Register our module's debug flag with _dev-mode custom hook
 */
Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(SbeCore.ID);
});

/**
 * Register our module's settings options
 */
Hooks.once('init', () => {
  registerSettings();
	preloadHandlebarsTemplates();
	// Enhance class OseItem with totalSlots during init
	CONFIG.Item.documentClass = sbeItem(CONFIG.Item.documentClass);
	CONFIG.Actor.documentClass = sbeActor(CONFIG.Actor.documentClass);
});

Hooks.once('ready', () => {
  // Unregister default OSE character sheet to load slot-based version
	const sbeCharSheet = loadActorSheetCharacter(CONFIG["Actor"].sheetClasses.character["ose.OseActorSheetCharacter"].cls);
	Actors.unregisterSheet("ose", CONFIG["Actor"].sheetClasses.character["ose.OseActorSheetCharacter"].cls);
	Actors.registerSheet("ose", sbeCharSheet, {
    types: ["character"],
    makeDefault: true,
    label: "SLOT-BASED-ENCUMBRANCE.labels.CharacterSheet",
  });
});