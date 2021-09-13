
const PACK_NAME = "choosy-temp-items";
const PACK_FULL = `world.${PACK_NAME}`
const DATA_TYPE = "text/plain";

class ChoosyBuilder extends Application{

	constructor(){
		super();
		this.currentChoices = []
	}

	static get defaultOptions()
	{
		const options = super.defaultOptions;
		options.id = "choosy-builder";
		options.template = "modules/choosy/templates/blankForm.html"
		options.resizable = true;
		options.height = "auto";
		options.width = 400;
		options.minimizable = true;
		options.title = "Choosy"
		return options;
	}

	static makeUuid(data, type){
		if ("pack" in data){
			//is from compendium
			return `Compendium.${data["pack"]}.${data["id"]}`;
		}

		//it is an item from the world
		return `${type}.${data.id}`;
	}

	async getItem(data){
		if (data["type"] == "Item"){
			let uuid = ChoosyBuilder.makeUuid(data, "Item");
			return fromUuid(uuid);
		}

		if (data["type"] == "Macro"){
			let uuid = ChoosyBuilder.makeUuid(data, "Macro");
			return fromUuid(uuid);
		}

		console.warn(`can't add ${data} because it is not an Item or Macro`);
		return;
	}

	makeData(item){
		return {
			name: item.data.name,
			img: item.data.img,
			uuid: item.uuid,
			type: item.documentName
		};
	}

	activateListeners(html) {
		super.activateListeners(html)

		if (!this.targetItem){
			//drop item in target
			html.find(".target-box").on("drop", null, this._newTargetItem.bind(this));

			return;
		}

		//control buttons for target item
		html.find(".remove-target").on("click", null, this._clearTargetItem.bind(this));
		html.find(".target-item-edit").on("click", null, this._editTargetItem.bind(this));


		//overall choice handlers
		html.find(".create-new-choice").on("click", null, this._addNewChoice.bind(this));

		//single choice handlers
		html.find(".remove-choice").on("click", null, this._removeChoice.bind(this))
		html.find(".choice-name-input").on("input", null, this._changeChoiceName.bind(this))
		html.find(".new-choice-box").on("drop", null, this._newChoiceBox.bind(this));

		//edit choices items
		html.find(".macro-args-change").on("input", null, this._changeMarcoArgs.bind(this))
		html.find(".choice-item-edit").on("click", null, this._choosyItemEdit.bind(this));
		html.find(".remove-choice-item").on("click", null, this._removeChoiceItem.bind(this));

		//new choice and item box handler

		html.find(".new-choice-and-item-box").on("drop", null, this._makeChoiceAndItem.bind(this))
		html.find(".full-window").on("dragstart", null, this._dragStart.bind(this))
	}

	async _newTargetItem(ev){
		let data = JSON.parse(ev.originalEvent.dataTransfer.getData(DATA_TYPE));

		let item = await this.getItem(data);

		if (!item){
			ui.notifications.error("Dropped item not found!");
			return;
		}

		if (item.documentName != "Item"){
			ui.notifications.error("Targeted item must be an item document class");
			return;
		}

		this.targetItem = this.makeData(item);

		let oldChoices = item.data.flags.choosy?.choices;

		if (oldChoices){
			this.currentChoices = await Promise.all(
				oldChoices.map(async (choice)=>{
					let ch = new Choice(this);

					ch.name = choice.name;
					ch.items = await Promise.all(choice.given.map(item =>{

							return fromUuid(item.uuid).
								then(res => {
									if (res){
										let out = this.makeData(res)

										if (item.type == "Macro"){
											out.args = item.args;
										}

										return out
									}
								});
						}));

					return ch
				})
			);

		}

		this.updateOutputItem();
		this.render();
	}

	_clearTargetItem(ev){
		this.targetItem = undefined;
		this.currentChoices = [];

		this.render();
	}

	async _editTargetItem(ev){
		let item = await fromUuid(this.targetItem.uuid);

		if (!item){
			ui.notifications.error("Target item not found!");
			return;
		}

		item.sheet.render(true);
	}

	async _addNewChoice(ev){
		this.currentChoices.push(new Choice(this));

		this.updateOutputItem();
		this.render();
	}

	async _removeChoice(ev){
		let listItem = ev.target.closest(".choosy-choice-set")
		this.currentChoices.splice(parseInt(listItem.dataset.index), 1);

		this.updateOutputItem();
		this.render();
	}

	async _changeChoiceName(ev){
		let listItem = ev.target.closest(".choosy-choice-set")
		let a = this.currentChoices[parseInt(listItem.dataset.index)]

		a.name = ev.target.value;
		this.updateOutputItem();
	}

	async _newChoiceBox(ev){
		let data = JSON.parse(ev.originalEvent.dataTransfer.getData(DATA_TYPE));

		//can't add self
		if (data.pack == PACK_FULL){
			return;
		}

		let item = await this.getItem(data);

		if (!item){
			ui.notifications.error("Failed to get item from drop event");
			return;
		}

		let itemData = this.makeData(item);

		let listItem = ev.target.closest(".choosy-choice-set")
		let choice = this.currentChoices[parseInt(listItem.dataset.index)]

		choice.pushNewItem(await itemData);

		this.updateOutputItem();
		this.render();
	}

	async _changeMarcoArgs(ev){
		let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
		let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

		let a = this.currentChoices[choiceIndex].items[itemIndex]

		a.args = ev.target.value;
		this.updateOutputItem();
	}

	async _choosyItemEdit(ev){
		let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
		let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

		let item = await fromUuid(this.currentChoices[choiceIndex].items[itemIndex].uuid);

		if (!item){
			ui.notifications.error("Item in choice no longer exists! You probably want to remove it");
			return;
		}

		item.sheet.render(true);
	}

	async _removeChoiceItem(ev){
		let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
		let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

		this.currentChoices[choiceIndex].items.splice(itemIndex, 1);
		this.updateOutputItem();
		this.render(true);
	}

	async _makeChoiceAndItem(ev){
		let data = JSON.parse(ev.originalEvent.dataTransfer.getData(DATA_TYPE));

		//can't add self
		if (data.pack == PACK_FULL){
			return;
		}

		let item = await this.getItem(data);

		if (!item){
			ui.notifications.error("Failed to get item from drop event");
			return;
		}

		let itemData = this.makeData(item);

		this.currentChoices.push(new Choice(this));
		this.currentChoices[this.currentChoices.length - 1].pushNewItem(itemData);

		this.updateOutputItem();
		this.render(true);
	}

	async _makeChoosyItem(ev){
		let itemData = await fromUuid(this.targetItem.uuid)

		if(!itemData){
			ui.notifications.error("Can't make item because initial item no longer exists");
			return;
		}

		let merged = mergeObject(itemData.toObject(),
			{'flags.choosy': {
				choices: this.currentChoices.map(c => c.toObject())
			}})

		let item = await Item.create(merged)
	}

	async _dragStart(ev){
		if (!this.currentChoices.reduce((acc, choice) => {return acc && choice.name != "";}, true)){
			ui.notifications.warn("At least 1 Choice has no name, choice will look funny");
		}

		ev.originalEvent.dataTransfer.setData(DATA_TYPE, JSON.stringify({
			type: "Item",
			pack: PACK_FULL,
			id: this.updateItem.id,
		}));
	}

	//don't perticularly like this solution but creates a compendium
	//that maintains a copy of the completed item.
	//This item is the one that is then dragged and dropped.
	//Temporary items don't have ids and therefore don't work with the drag
	//and drop interface
	async updateOutputItem(){
		let itemData = await fromUuid(this.targetItem.uuid)

		if(!itemData){
			ui.notifications.error("Can't make item because initial item no longer exists");
			return;
		}

		await ChoosyBuilder.ensureTempCompendium();
		this.removeOldItems();

		let itemClone = itemData.clone({
			'flags.choosy.choices': this.currentChoices.map(c => c.toObject())
		})

		this.updateItem = await Item.create(itemClone.toObject(), {temporary: true}).
			then(async(res) => {
				return game.packs.get(PACK_FULL).importDocument(res)
			});
	}

	close(){
		super.close();
		this.removeOldItems();
	}

	removeOldItems(){
		game.packs.get(PACK_FULL).contents.forEach(item => item.delete());
	}

	getEmptyDiv(){
		return `<div class="target-box choosy-builder-qualifier empty-box">Drop item here to start</div>`
	}

	getTargetedDiv(){
		return `
		<h2>Currently working off of:</h2>
		<div class="target-item flexrow choosy-builder-qualifier item">
			<div class="choosy-builder-qualifier item-image" style="background-image: url('${this.targetItem.img}')"></div>
			<div>${this.targetItem.name}</div>
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="target-item-edit" ><i class="fas fa-edit"></i></a>
			<a class="remove-target" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	getChoicesDiv(){
		return `<div>
			<div class="flexrow"><h2>Choices</h2><a class="create-new-choice">+ Add</a></div>
			<ol>
				${this.currentChoices.reduce((acc, val, index)=>{
					return acc + val.getListItem(index);
				}, "")}
			</ol>
			<div class="new-choice-and-item-box choosy-builder-qualifier empty-box">Make a new choice with an item</div>
		</div>`
	}

	getMakeItMessage(){
		return `<p>Drag this window to create a new item</p>`
	}

	wrapDrop(str){
		return `<div draggable="true" class="full-window">${str}</div>`;
	}

	async getData(){
		const sheetData = super.getData();

		if (this.targetItem){
			sheetData.div = this.wrapDrop(this.getTargetedDiv() + this.getChoicesDiv() + this.getMakeItMessage());
		}
		else{
			sheetData.div = this.getEmptyDiv();
		}

		return sheetData;
	}

	static async ensureTempCompendium(){
		let pack = game.packs.get(PACK_FULL);

		if (!pack){
			return await CompendiumCollection.createCompendium({
				entity: "Item",
				label: `${PACK_NAME}`,
				name: `${PACK_NAME}`,
				package: "world",
				private: true
			})
		}

		return pack;
	}
}

class Choice{
	constructor(parent){
		this.name = ""
		this.items = []
		this.parent = parent
	}

	pushNewItem(item){
		this.items.push(item);

		//test for automatically naming the choice
		if (this.items.length == 1 && this.name == ""){
			let match = item.name.match(new RegExp(`${this.parent.targetItem.name}: (.+)`));

			if (match){
				this.name = match[1]
			}
		}
	}

	static getItemDisplay(item){
		if (!item){
			return Choice.getEmptyDisplay(item);
		}

		if (item.type == "Item"){
			return Choice.getFilledItemDisplay(item);
		}
		else if (item.type == "Macro"){
			return Choice.getFilledMacroDisplay(item);
		}

		return Choice.getEmptyDisplay(item);
	}

	static getFilledItemDisplay(item){
		return `<div class="flexrow choosy-builder-qualifier item">
			<div class="choosy-builder-qualifier item-image" style="background-image: url('${item.img}')"></div>
			<div>${item.name}</div>
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="choice-item-edit" ><i class="fas fa-edit"></i></a>
			<a class="remove-choice-item" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	static getFilledMacroDisplay(item){
		return `<div class="flexrow choosy-builder-qualifier item">
			<div class="choosy-builder-qualifier item-image" style="background-image: url('${item.img}')"></div>
			<div>${item.name}</div>
			<input class="macro-args-change" type="string" value="${item.args ?? ""}">
			<div class="choosy-builder-qualifier item-controls flexrow">
				<a class="choice-item-edit" ><i class="fas fa-edit"></i></a>
				<a class="remove-choice-item" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	static getEmptyDisplay(item){
		return `<div class="flexrow choosy-builder-qualifier item">
			<div>Missing Item, Delete Me</div>
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="remove-choice-item" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	getListItem(index){
		return `<li class="choosy-choice-set" data-index="${index}">
		<div class="flexrow choosy-builder-qualifier item">
			<div>Choice: </div>
			<input class="choice-name-input" type="string" value="${this.name}">
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="remove-choice" ><i class="fas fa-trash"></i></a>
			</div>
		</div>
		<ol>
		${this.items.reduce((acc, item, index) => {
			return acc + `<li class="choice-item-line" data-index="${index}">
				${Choice.getItemDisplay(item)}
			</li>`
		}, "")}
		</ol>
		<div class="new-choice-box choosy-builder-qualifier empty-box">Add item to this choice</div>
		</li>`
	}

	toObject(){

		return {
			name: this.name,
			given: this.items.map(val => {
				let a = {
					type: val.type,
					uuid: val.uuid
				};

				if (val.type == "Macro"){
					a.args = val.args || "";
				}

				return a;
			})
		}
	}
}

export default ChoosyBuilder;