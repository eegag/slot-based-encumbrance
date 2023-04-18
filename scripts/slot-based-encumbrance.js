/**
 * Global variable to add condition modifiers to rolls
 * Change once OSE system is more mod friendly again?
 */
var cModGlobal = null;

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
 * Class to populate the detailed movement settings form
 */
class MovementConfigForm extends FormApplication {
	constructor(data, options) {
			super(data, options);
			this.data = data;
	}

  getData() {
    const data = {};
    data.mvThreshold = {
			90: game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold90,
			60: game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold60,
			30: game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold30,
    }
    return data;
  }
	
	/**
	 * Default Options for this FormApplication
	 */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
				id: "movement-config",
				title: "SLOT-BASED-ENCUMBRANCE.config.Title",
				template: "./modules/slot-based-encumbrance/templates/movement-config.html",
				classes: ["sheet"],
				width: 500
		});
	}

	/**
	 * Update on form submit
	 * @param {*} event 
	 * @param {*} formData 
	 */
	async _updateObject(event, formData) {
		await game.settings.set("slot-based-encumbrance", "mvThresholds", {
				mvThreshold90: formData["mv-threshold-90"],
				mvThreshold60: formData["mv-threshold-60"],
				mvThreshold30: formData["mv-threshold-30"]
		});
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
		
		if (data.type == "ability" || data.type == "spell") {
			return;
		}
		
		if (data.type == "weapon") {

			// Slot field html literal
			const weaponSlotField = `
						<label title="${slotsLabel}"><i class="fas fa-weight-hanging"></i></label>
            <div class="form-fields">
              <input type="text" name="flags.slots" value="${data.flags.slots}" data-dtype="Number" />
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
							<input type="text" name="flags.slots" value="${data.flags.slots}" data-dtype="Number" />
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
 * Class to modify the roll dialog
 */
class UpdateRollDialog {
  static async includeModifiers(app, html, data) {

		if (html[0].innerHTML.indexOf("Situational Modifier") == -1) {
			return;
		}

		// Find Situation Modifier field
		const eField = document.querySelector("div.form-group input[name='bonus']");

		// Add modifier from conditions into Sit Mod field
		if (cModGlobal !== 0) {
			eField.value = cModGlobal;
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
		
		activateListeners(html) {
			super.activateListeners(html);
			
			html.find(".item-toggle").click(async (ev) => {
				const li = $(ev.currentTarget).parents(".item");
				const item = this.actor.items.get(li.data("itemId"));
				if (item.type != "weapon" && item.type != "armor") {
					await item.update({
						flags: {
							equipped: !item.flags.equipped,
						},
					});
				}
			});
			
			this.options.editable && (html.find(".condition-create").click((html=>{
				this.actor.createEmbeddedDocuments("Item",[
					{
						name: "New Condition",
						type: "item",
						flags: {
							condition: true
						}
					}
				])
			}
			)))
		}
	}
	
	return SbeActorSheetCharacter;
}

/**
 * Function to extend the OseActor class during init hook
 * to compute encumbrance and movement speed
 */
function sbeActor(superclass) {
	return class SbeActor extends superclass {

		prepareData() {
			super.prepareData();
			this.computeInventorySlots();
			this.addConditionPenalties();
		}

	  /**
	   * Function to calculate the actor's slot maximum and currently filled slots
	   * Then calls function to determine movement speed
	   */
		computeInventorySlots() {
			if (this.type != "character" && this.type != "monster") {
				return;
			}
			
			const data = this.system;
			const countEquipped = game.settings.get("slot-based-encumbrance", "countEquipped");
			const showNotify = game.settings.get("slot-based-encumbrance", "showNotify");
			const mvCalcType = game.settings.get("slot-based-encumbrance", "mvCalcType");
			
			const mvThreshold90 = game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold90;
			const mvThreshold60 = game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold60;
			const mvThreshold30 = game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold30;
			
			// Compute encumbrance
			const items = [...this.items.values()];
			let heldItems = 0;
			let wornArmor = 0;
			let totalWeight = items.reduce((acc, item) => {
				
				// Unequip items on monster actors
				if (this.type == "monster") {
					item.system.equipped = false;
				}
				
				// Equipped containers don't count, but track how many hands you need
				if (countEquipped && item.type == "container" && item.flags.equipped) {
					heldItems = item.flags.totalSlots > 4 ? heldItems + 2 : heldItems + 1;
					return acc + item.flags.slots - item.flags.totalSlots;
				// Don't double count containers and their contents
				} else if (item.type == "container") {
					return acc + item.flags.slots;
				// Equipped armor doesn't count either
				} else if (countEquipped && item.system.containerId == "" && item.system.equipped && item.type == "armor" && item.system.type != "shield") {
					if (item.system.type != "unarmored") {
						wornArmor++;
					}
					return acc;
				// Other equipped items don't count either, but track how many hands you need
				}	else if (countEquipped && item.system.containerId == "" && (item.system.equipped || item.flags.equipped)) {
					heldItems = heldItems + item.flags.slots;
					return acc;
				} else if (item.type == "ability" || item.type == "spell"){
					return acc;
				}	else {
					return acc + item.flags.totalSlots;
				}
			}, 0);

			// If you tried to wear multiple suits of armor, annoy you with a message
			if (game.ready && wornArmor > 1 && this.isOwner && !game.user.isGM && showNotify) {
				ui.notifications.error(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.TooMuchArmorMessage")
					);
			}

			// If you tried to hold too many items, annoy you with a message
			if (game.ready && heldItems > 2 && this.isOwner && !game.user.isGM && showNotify) {
				ui.notifications.warn(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.TooManyHeldItemsMessage")
					);
			}
			
			let max = 0;
				
			if (this.type != "monster") {
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
			} else if ("inventory" in this.flags) {
				max = this.flags.inventory.max;
			}
			
			let steps =
				mvCalcType === "detailed"
				? [(100 * mvThreshold90) / max, (100 * mvThreshold60) / max, (100 * mvThreshold30) / max]
				: [];
			
			this.flags.inventory = {
				pct: Math.clamped((100 * parseFloat(totalWeight)) / max, 0, 100),
				max: max,
				encumbered: totalWeight > max || heldItems > 2,
				value: totalWeight,
				steps: steps,
			};
			
			if (this.type != "monster" && mvCalcType == "detailed") {
				this.calculateDetailedMovement();
			} else if (this.type != "monster") {
				this.calculateBasicMovement();
			}
		}

	  /**
	   * Function to calculate the actor's movement speed based on armor worn
	   * Called if Basic movement selected in module settings
	   */
		calculateBasicMovement() {
			const data = this.system;
			const weight = this.flags.inventory.value;
			const showNotify = game.settings.get("slot-based-encumbrance", "showNotify");

			const armors = this.items.filter((i) => i.type === "armor");
			let heaviest = 0;
			armors.forEach((a) => {
				const armorData = a.system;
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
			
	    if (this.flags.inventory.encumbered) {
				data.movement.base = 0;
				if (game.ready && this.isOwner && !game.user.isGM && showNotify) {
					ui.notifications.warn(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.EncumberedWarningMessage")
					);
				}
			}
		}
		
	  /**
	   * Function to calculate the actor's movement speed based on slots filled
	   * Called if Detailed movement selected in module settings
	   */
		calculateDetailedMovement() {
			const data = this.system;
			const weight = this.flags.inventory.value;
			const showNotify = game.settings.get("slot-based-encumbrance", "showNotify");
			
			const mvThreshold90 = game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold90;
			const mvThreshold60 = game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold60;
			const mvThreshold30 = game.settings.get("slot-based-encumbrance", "mvThresholds").mvThreshold30;

			if (this.flags.inventory.encumbered) {
				data.movement.base = 0;
				if (game.ready && this.isOwner && !game.user.isGM && showNotify) {
					ui.notifications.warn(
					game.i18n.localize("SLOT-BASED-ENCUMBRANCE.messages.EncumberedWarningMessage")
					);
				}
			} else if (weight <= mvThreshold90) {
				data.movement.base = 120;
			} else if (weight <= mvThreshold60) {
				data.movement.base = 90;
			} else if (weight <= mvThreshold30) {
				data.movement.base = 60;
			} else {
				data.movement.base = 30;
			}
		}
		
		addConditionPenalties() {
			if (this.id == null || !this.isOwner) {
				return;
			}
			
			const items = [...this.items.values()];
			
			let cumulativePenalty = items.reduce((acc, item) => {
				
				if (item.flags.condition) {
					return acc + item.flags.totalSlots;
				} else {
					return acc;
				}
			}, 0);
			if (this.flags.modifiers != cumulativePenalty * -1) {
				this.flags.modifiers = cumulativePenalty * -1;
				
				this.update({
					flags: this.flags
				});
			}
		}
		
		rollSave(e, t={}) {
			cModGlobal = this.flags.modifiers;

			super.rollSave(e, t);
    }
		
		rollCheck(e, t={}) {
			cModGlobal = this.flags.modifiers * -1;

			super.rollCheck(e, t);
    }
		
		rollAttack(e, t={}) {
			cModGlobal = this.flags.modifiers;

			super.rollAttack(e, t);
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
		
		if (this.type == "ability" || this.type == "spell") {
			return;
		}
		
		this.flags.slots = this.createSlotValue();
		this.flags.totalSlots = this.createTotalSlots();
		}

		/** 
		* If no slot value exists, set a value based on item type and weight.
		* Default to 1 if no weight exists.
		*/
		createSlotValue() {
			const coinsPerSlot = game.settings.get("slot-based-encumbrance", "coinsPerSlot");

			if (this.type == "ability" || this.type == "spell") {
				return;
			}

			if (this.flags.slots == null || this.flags.slots == undefined) {
				if (!this.system.weight) {
					return 1;
				}	else if (this.type == "armor" && this.system.type != "shield") {
					return Math.floor(this.system.weight/200);
				} else if (this.type == "treasure") {
					return Math.ceil(this.system.cost/coinsPerSlot);
				} else {
					return Math.ceil(this.system.weight/100);
				}
			// Reset empty containers
			} else if (this.type == "container" && this.flags.slots == 0) {
				return 1;
			} else {
				return this.flags.slots;
			}
		}

		/**
		 * Create a totalSlots value
		 * Check for container with contents
		 * Check for bundled items
		 */
		createTotalSlots() {
			if (this.type == "ability" || this.type == "spell" || this.flags.slots === undefined) {
				return;
			}

			const coinsPerSlot = game.settings.get("slot-based-encumbrance", "coinsPerSlot");
			
			//Container totalSlots calculation (with embedded totalSlots math to recalc item totals)
			if (this.type == "container" && this.actor) {

				const actorItems = this.actor.items.contents;
				const containerID = this._id;
				let slotTotal = 0;
				
				for (let i = 0; i < actorItems.length; i++) {
					if (actorItems[i].system.containerId == containerID) {
						let totalSlots;
						if (actorItems[i].system.treasure) {
							totalSlots = Math.ceil(actorItems[i].system.quantity.value/coinsPerSlot);
						}	else if (!actorItems[i].system.quantity.max) {
							totalSlots = actorItems[i].flags.slots * actorItems[i].system.quantity.value;
						} else {
							totalSlots = Math.ceil(actorItems[i].system.quantity.value/actorItems[i].system.quantity.max);
						}
						
						slotTotal = slotTotal + totalSlots;

					}
				}
				
				if (slotTotal === 0) {
					slotTotal = this.flags.slots;
				} else {
					this.flags.slots = 0;
				}
				return slotTotal;

			//Standard totalSlots calculation
			} else {				
				if (this.system.treasure) {
					return Math.ceil(this.system.quantity.value/coinsPerSlot);
				} else if (!this.system.quantity.max) {
					return this.flags.slots * this.system.quantity.value;
				} else {
					return Math.ceil(this.system.quantity.value/this.system.quantity.max);
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
	
  game.settings.register("slot-based-encumbrance", "mvCalcType", {
    name: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.MvCalcType"),
    hint: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.MvCalcTypeHint"),
    default: "basic",
    scope: "world",
    type: String,
    config: true,
    choices: {
			basic: "SLOT-BASED-ENCUMBRANCE.settings.MvBasic",
			detailed: "SLOT-BASED-ENCUMBRANCE.settings.MvDetailed",
    },
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
	
		game.settings.register("slot-based-encumbrance", "showNotify", {
    name: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.ShowNotify"),
    hint: game.i18n.localize("SLOT-BASED-ENCUMBRANCE.settings.ShowNotifyHint"),
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });
	
	game.settings.register("slot-based-encumbrance", "mvThresholds", {
			name: "name",
			hint: "hint",
			scope: "world",
			type: Object,
			default: {
					mvThreshold90: "",
					mvThreshold60: "",
					mvThreshold30: ""
			},
			config: false,
			onChange: s => {

			}
	});
	
		game.settings.registerMenu("slot-based-encumbrance", "movementConfigMenu",{
			name: "SLOT-BASED-ENCUMBRANCE.settings.MvConfigButton",
			label: "SLOT-BASED-ENCUMBRANCE.settings.MvConfigLabel",
			hint: "SLOT-BASED-ENCUMBRANCE.settings.MvConfigHint",
			icon: "fas fa-cog",
			type: MovementConfigForm,
			restricted: true
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
 * Render ItemSheet Hook for slots field
 */
Hooks.on("renderItemSheet", (app, html, data) => {
	UpdateItemSheet.addSlotFields(app, html, data);
});

/**
 * Render Application Hook for roll-dialog
 */
Hooks.on("renderDialog", (app, html, data) => {
	UpdateRollDialog.includeModifiers(app, html, data);
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
	console.log(`Slot-Based-Encumbrance`);
	// Extend OseItem and OseActor classes with slots and totalSlots during init
	CONFIG.Item.documentClass = sbeItem(CONFIG.Item.documentClass);
	CONFIG.Actor.documentClass = sbeActor(CONFIG.Actor.documentClass);
});

Hooks.once('ready', () => {
  // Unregister default OSE character sheet to load slot-based version
	const sbeCharSheet = loadActorSheetCharacter(CONFIG.Actor.sheetClasses.character["ose.I"].cls);
	Actors.unregisterSheet("ose", CONFIG.Actor.sheetClasses.character["ose.I"].cls);
	Actors.registerSheet("ose", sbeCharSheet, {
    types: ["character"],
    makeDefault: true,
    label: "SLOT-BASED-ENCUMBRANCE.labels.CharacterSheet",
  });
});