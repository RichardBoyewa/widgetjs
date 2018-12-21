define([
	"./widget-extensions",
	"./router",
	"./events",
	"./htmlCanvas",
	"./widget-common",
	"jquery"
], function(widgetExtensions, router, events, htmlCanvas, widgetCommon) {

	let {idGenerator, currentWidget, inRenderingLoop, withCurrentWidget} = widgetCommon;

	/**
	 * Base for all widgets. A widget can keep state in variables, contain logic and
	 * render itself using `renderOn()`.
	 *
	 * @example
	 *
	 *        var titleWidget = function(spec) {
	 *			var that = widget(spec);
	 *
	 *			var title = spec.title || "Hello World";
	 *
	 *			that.renderContentOn = function(html) {
	 *				html.h1(title)
	 *			}
	 *
	 *			return that;
	 *		};
	 *
	 *        var helloWorldWidget = titleWidget({title: "Hello Widget!"});
	 *
	 *        $(document).ready(function() {
	 *			helloWorldWidget.appendTo("BODY");
	 *		});
	 *
	 * Widgets can also be rendered on a HTML canvas (since widget implements `appendToBrush()`). Eg.
	 *
	 *        html.div(helloWorldWidget)
	 *
	 * It is therefor easy to compose widgets from other widgets.
	 *
	 * @virtual
	 *
	 * @param {Object} spec
	 * @param {String} [spec.id] Unique id for widget. Also used for root element when attached/rendered to DOM.
	 *                           If not provided an ID will automatically be generated and assigned.
	 * @param {Object} [my]
	 *
	 * @returns {widget}
	 */
	return class Widget extends Object {
		constructor({id} = {}) {
			super(...arguments);

			this._id = id || idGenerator.newId();

			// When within an update transaction, do not update the widget
			this._inUpdateTransaction = false;

			// Keep track of the rendered subwidgets
			this._children = [];

			// Events for widget
			this._events		= events.eventCategory();
			this.onAttach		= this._events.createEvent();
			this.onDetach		= this._events.createEvent();
			this.register		= this._events.register;
			this.registerOnce	= this._events.registerOnce;
			this.unregister		= this._events.unregister;
			this.trigger		= this._events.trigger;

			// Route / Controller extensions
			this._router = router.getRouter();

			this._linkTo = this._router.linkTo;
			this._linkToPath = this._router.linkToPath;
			this._linkToUrl = this._router.linkToUrl;

			this._redirectTo = this._router.redirectTo;
			this._redirectToPath = this._router.redirectToPath;
			this._redirectToUrl = this._router.redirectToUrl;

			this._getParameters = this._router.getParameters;
			this._getParameter = this._router.getParameter;
			this._setParameters = this._router.setParameters;

			// Third party protected extensions** added to `my`.
			// See widget-extensions.js
			for (var extProperty in widgetExtensions) {
				if (widgetExtensions.hasOwnProperty(extProperty)) {
					this[extProperty] = widgetExtensions[extProperty];
				}
			}
		}

		/**
		 * Hook evaluated at the end of widget initialization and
		 * before any rendering.
		 */
		_initializeSubwidgets() {
			// override in subclasses if necessary
		}

		_postInitialize() {
			this._initializeSubwidgets(...arguments);
		}

		//
		// Public
		//

		/**
		 * Returns a unique id for the widget
		 *
		 * @returns {String}
		 */
		getId() {
			return this._id;
		}

		/**
		 * Performance tasks need for freeing/releasing/cleaning-up resources used by widget.
		 *
		 * Should always be executed before a widget is disposed. Especially
		 * if the widget register events to avoid memory leaks.
		 *
		 * Most widgets should override `my.dispose` instead of overriding
		 * this function.
		 *
		 */
		dispose() {
			this._children.forEach((child) => {
				child.dispose();
			});

			this._dispose();

			this._events.dispose();
		}

		/**
		 * Method to be performed when a root widget is detached from the
		 * DOM. The widegt and all its children will call `my.willDetach` in
		 * turn.
		 */
		willDetach() {
			this._children.forEach((child) => {
				child.willDetach();
			});

			this._willDetach();
			this.onDetach.trigger();
		}

		/**
		 * Renders the widget on a JQuery / DOM
		 *
		 * @example
		 * widget.appendTo("BODY");
		 *
		 * @param aJQuery
		 */
		appendTo(aJQuery) {
			this._withAttachHooks(() => {
				this._renderBasicOn(htmlCanvas(aJQuery));
			});
		}

		/**
		 * Does the same as appendTo except it first clear the
		 * elements matched by aJQuery
		 *
		 * @param aJQuery
		 */
		replace(aJQuery) {
			this._withAttachHooks(() => {
				var canvas = htmlCanvas(aJQuery);
				canvas.root.asJQuery().empty();
				this._renderBasicOn(canvas);
			});
		}

		/**
		 * Answers a jQuery that match the root DOM element. By default
		 * by selecting an element that have the same ID as the widget.
		 *
		 * See "renderOn"
		 *
		 * @returns {*}
		 */
		asJQuery() {
			return jQuery("#" + this.getId());
		}

		/**
		 * Answers true if if widget have rendered content in DOM
		 *
		 * @returns {boolean}
		 */
		isRendered() {
			return this.asJQuery().length > 0;
		}

		/**
		 * Implementation for `appendToBrush()` to allow a widget to be
		 * appended to a brush. See "htmlCanvas".
		 *
		 * Basically it allows us to do:
		 *        html.div(widget);
		 *
		 * @param aTagBrush
		 */
		appendToBrush(aTagBrush) {
			this._withAttachHooks(() => {
				this._renderBasicOn(htmlCanvas(aTagBrush.asJQuery()));
			});
		}

		/**
		 * Trigger the `willAttach` event on the receiver and all
		 * rendered subwidgets.
		 */
		triggerWillAttach() {
			this._willAttach();
			this._children.forEach((widget) => {
				widget.triggerWillAttach();
			});
		}

		/**
		 * Trigger the `didAttach` event on the receiver and all
		 * rendered subwidgets.
		 */
		triggerDidAttach() {
			this._didAttach();
			this._children.forEach((widget) => {
				widget.triggerDidAttach();
			});
			this.onAttach.trigger();
		}

		/**
		 * Evaluate `fn`, calling `willAttach` before and `didAttach` after
		 * the evaluation.
		 */
		_withAttachHooks(fn) {
			var inRendering = inRenderingLoop();
			if (!inRendering) {
				this.triggerWillAttach();
			}
			fn();
			if (!inRendering) {
				this.triggerDidAttach();
			}
		}

		/**
		 * Create and expose an event named `name`.
		 */
		_createEvent(name) {
			this[name] = this._events.createEvent();
		}

		/**
		 * Create and expose one event per string argument.
		 */
		_createEvents() {
			var names = Array.prototype.slice.apply(arguments);
			names.forEach(this._createEvent);
		}

		//
		// Protected
		//

		/**
		 * Exposes the internal ID generator. Generates new unique IDs to be used
		 * for sub-widgets, etc.
		 *
		 * @returns {String}
		 */
		nextId() {
			return idGenerator.newId();
		}

		/**
		 * Widget specific dispose.
		 */
		_dispose() {
			// override in subclasses if necessary
		}

		//
		// Render
		//

		/**
		 * Private rendering function.    This is the function
		 * internally called each time the widget is rendered, in
		 * `appendTo`, `replace` and `update`.
		 *
		 */
		_renderBasicOn(html) {
			this._withChildrenRegistration(() => {
				this.renderOn(html);
			});
		}

		/**
		 * Main entry point for rendering. For convenience "renderOn" will    wrap the content
		 * rendered by "renderContentOn" in a root element (renderRootOn) that will be matched
		 * by asJQuery.
		 *
		 * Usually concrete widgets override "renderContentOn" to render it content. Widgets
		 * can override "renderOn" but must then make sure that it can be matched by "asJQuery".
		 *
		 * One way to do that is to make sure to have only one root element and setting the ID of
		 * that element to the ID of the widget.
		 *
		 * @example
		 *
		 *        that.renderOn = function(html) {
		 *			html.ul({id: that.getId()}
		 *				html.li("BMW"),
		 *				html.li("Toyota")
		 *			);
		 *		};
		 *
		 *
		 * @param html
		 */
		renderOn(html) {
			// Renders widget by wrapping `renderContentOn()` in a root element.
			this._renderRootOn(html).render(this.renderContentOn.bind(this));
		}

		_withChildrenRegistration(fn) {
			var parent = currentWidget.get();
			if (parent) {
				parent.registerChild(this);
			}
			withCurrentWidget(() => {
				this._children = [];
				fn();
			}, this);
		}

		registerChild(widget) {
			this._children.push(widget);
		}

		/**
		 * Renders a wrapper element (by default a "widgetjs-widget" tag) and
		 * set the element ID to the ID of the widget so that it can be found by
		 * "asJQuery" eg. when we re-render using "update".
		 *
		 * @param html
		 * @returns {htmlBrush}
		 */
		_renderRootOn(html) {
			return html.tag("widgetjs-widget").id(this._id);
		}

		/**
		 * Overridden in concrete widgets to render widget to canvas/DOM.
		 *
		 * @example
		 *
		 *        that.renderContentOn = function(html) {
		 *			html.ul(
		 *				html.li("BMW"),
		 *				html.li("Toyota")
		 *			);
		 *		};
		 *
		 * @param {htmlCanvas} html
		 */
		renderContentOn(html) {
			return this._subclassResponsibility();
		}

		/**
		 * Hook evaluated before the widget is attached (or reattached due
		 * to an update of rendering) to the DOM.
		 */
		_willAttach() {}

		/**
		 * Hook evaluated each time the widget is attached (or
		 * reattached due to an update of rendering) to the DOM.
		 */
		_didAttach() {}

		/**
		 * Hook evaluated when a widget is detached from the DOM.
		 */
		_willDetach() {}

		/**
		 * Hook evaluated before widget update.
		 */
		_willUpdate() {}

		/**
		 * Re-renders the widget and replace it in the DOM
		 */
		update() {
			if (this._inUpdateTransaction || !this.isRendered()) {
				return;
			}

			this._willUpdate();
			this._withAttachHooks(() => {
				// clear content of root
				this.asJQuery().empty();

				// re-render content on root
				var html = htmlCanvas(this.asJQuery());
				this._withChildrenRegistration(() => {
					this.renderContentOn(html);
				});
			});
		}

		withinTransaction(fn, onDone) {
			if (this._inUpdateTransaction) {
				fn();
			} else {
				try {
					this._inUpdateTransaction = true;
					fn();
				}
				finally {
					this._inUpdateTransaction = false;
					if (onDone) {
						onDone();
					}
				}
			}
		}

		/**
		 * Evaluate `fn`, ensuring that an update will be
		 * performed after evaluating the function. Nested calls
		 * to `withUpdate` or `update` will result in updating the
		 * widget only once.
		 */
		withUpdate(fn) {
			this.withinTransaction(fn, this.update.bind(this));
		}

		withNoUpdate(fn) {
			this.withinTransaction(fn);
		}
	};
});
