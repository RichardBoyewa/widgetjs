define(
    [
        './widget-extensions',
        './router',
        './events',
        './htmlCanvas',
        'jquery'
    ],

    function (ext, router, events, htmlCanvas, jQuery) {

        /**
         * Base for all widgets. A widget can keep state in variables, contain logic and
         * render itself using `renderOn()`.
         *
         * @example
         *
         *      var titleWidget = function(spec) {
         *          var that = widget(spec);
         *
         *          var title = spec.title || 'Hello World';
         *
         *          that.renderContentOn = function(html) {
         *              html.h1(title)
         *          }
         *
         *          return that;
         *      };
         *
         *      var helloWorldWidget = titleWidget({title: 'Hello Widget!'});
         *
         *      $(document).ready(function() {
         *          helloWorldWidget.appendTo('BODY');
         *      });
         *
         * Widgets can also be rendered on a HTML canvas (since widget implements `appendToBrush()`). Eg.
         *
         *      html.div(helloWorldWidget)
         *
         * It is therefor easy to compose widgets from other widgets.
         *
         *
         * @param {Object} spec
         * @param {String} [spec.id] Unique id for widget. Also used for root element when attached/rendered to DOM.
         *                           If not provided an ID will automatically be generated and assigned.
         * @param {Object} [my]
         *
         * @returns {widget}
         */
        var widget = function (spec, my) {
            my = my || {};
            spec = spec || {};

            /** @typedef {{}} widget */
            var that = {};

            var id = spec.id || idGenerator.newId();

            /** When within an update transaction, do not update the widget */
            var inUpdateTransaction = false;

            /**
             * Keep track of the rendered subwidgets
             */
            var children = [];

            /** Events for widget */
            my.events = events.eventCategory();

            /**
             * Event triggered each time the widget is attached (or
             * reattached due to an update of rendering) to the DOM.
             */
            that.didAttach = my.events.createEvent();

            //
            // Public
            //

            /**
             * Returns a unique id for the widget
             *
             * @returns {String}
             */
            that.getId = function () {
                return id;
            };

            that.id = that.getId; //TODO: deprecated

            /**
             * Performance tasks need for freeing/releasing/cleaning-up resources used by widget.
             *
             * Should always be executed before a widget is disposed. Especially
             * if the widget register events to avoid memory leaks.
             *
             * If overridden in a subclass, make sure to execute `my.disposeWidget()`.
             *
             */
            that.dispose = function() {
                my.disposeWidget();
            };

            /**
             * Renders the widget on a JQuery / DOM
             *
             * @example
             *    widget.appendTo('BODY');
             *
             * @param aJQuery
             */
            that.appendTo = function (aJQuery) {
                that.renderOn(htmlCanvas(aJQuery));
                that.triggerDidAttach();
            };

            /**
             * Does the same as appendTo except it first clear the
             * elements matched by aJQuery
             *
             * @param aJQuery
             */
            that.replace = function (aJQuery) {
                var canvas = htmlCanvas(aJQuery);
                canvas.root.asJQuery().empty();
                that.renderOn(canvas);
                that.triggerDidAttach();
            };

            /**
             * Answers a jQuery that match the root DOM element. By default
             * by selecting an element that have the same ID as the widget.
             *
             * See 'renderOn'
             *
             * @returns {*}
             */
            that.asJQuery = function () {
                return jQuery('#' + that.getId());
            };

            /**
             * Answers true if if widget have rendered content in DOM
             *
             * @returns {boolean}
             */
            that.isRendered = function () {
                return that.asJQuery().length > 0;
            };

            /**
             * Implementation for `appendToBrush()` to allow a widget to be
             * appended to a brush. See 'htmlCanvas'.
             *
             * Basically it allows us to do:
             *      html.div(widget);
             *
             * @param aTagBrush
             */
            that.appendToBrush = function (aTagBrush) {
                that.appendTo(aTagBrush.asJQuery());
            };

            /**
             * Trigger the `didAttach` event on the receiver and all
             * rendered subwidgets.
             */
            that.triggerDidAttach = function() {
                that.didAttach.trigger();
                children.forEach(function (widget) {
                    widget.triggerDidAttach();
                });
            };

            // Expose events
            that.on = my.events.on;
            that.onceOn = my.events.onceOn;
            that.off = my.events.off;
            that.trigger = my.events.trigger;

            //
            // Protected
            //

            /**
             * Exposes the internal ID generator. Generates new unique IDs to be used
             * for sub-widgets, etc.
             *
             * @returns {String}
             */
            my.nextId = function () {
                return idGenerator.newId();
            };

            /**
             * Widget specific dispose.
             */
            my.disposeWidget = function() {
              my.events.dispose();
            };

            my.trigger = my.events.trigger;

            // Route / Controller extensions

            my.router = router.getRouter();

            my.linkTo = my.router.linkTo;
            my.linkToPath = my.router.linkToPath;
            my.linkToUrl = my.router.linkToUrl;

            my.redirectTo = my.router.redirectTo;
            my.redirectToPath = my.router.redirectToPath;
            my.redirectToUrl = my.router.redirectToUrl;

            my.getParameters = my.router.getParameters;
            my.getParameter = my.router.getParameter;
            my.setParameters = my.router.setParameters;

            //
            // Render
            //

            /**
             * Main entry point for rendering. For convenience 'renderOn' will  wrap the content
             * rendered by 'renderContentOn' in a root element (renderRootOn) that will be matched
             * by asJQuery.
             *
             * Usually concrete widgets override 'renderContentOn' to render it content. Widgets
             * can override 'renderOn' but must then make sure that it can be matched by 'asJQuery'.
             *
             * One way to do that is to make sure to have only one root element and setting the ID of
             * that element to the ID of the widget.
             *
             * @example
             *
             *      that.renderOn = function (html) {
             *          html.ul({id: that.getId()}
             *              html.li('BMW'),
             *              html.li('Toyota')
             *          );
             *      };
             *
             *
             * @param html
             */
            that.renderOn = function (html) {
                // Renders widget by wrapping `renderContentOn()` in a root element.
                my.withRenderingRegistration(function() {
                    my.renderRootOn(html).render(that.renderContentOn);
                });
            };

            /**
             * Keep track of the current rendered widget
             */
            var currentWidget;

            my.withRenderingRegistration = function(fn) {
                var parent = currentWidget;
                if(parent) {
                    parent.registerChild(that);
                }
                currentWidget = that;
                try {
                    my.children = [];
                    fn();
                } finally {
                    currentWidget = parent;
                }
            };

            that.registerChild = function(widget) {
                children.push(widget);
            };

            /**
             * Renders a wrapper element (by default a 'widgetjs-widget' tag) and
             * set the element ID to the ID of the widget so that it can be found by
             * 'asJQuery' eg. when we re-render using 'update'.
             *
             * @param html
             * @returns {htmlBrush}
             */
            my.renderRootOn = function (html) {
                return html.tag('widgetjs-widget').id(id);
            };

            /**
             * Overridden in concrete widgets to render widget to canvas/DOM.
             *
             * @example
             *
             *      that.renderContentOn = function (html) {
             *          html.ul(
             *              html.li('BMW'),
             *              html.li('Toyota')
             *          );
             *      };
             *
             * @param {htmlCanvas} html
             */
            that.renderContentOn = function (html) {};

            /**
             * Re-renders the widget and replace it in the DOM
             *
             * Content is first re-rendered on a document fragment. Update then replace the element matched
             * by 'asJQuery' with the new content.
             *
             */
            that.update = function () {
                if (inUpdateTransaction || !that.isRendered()) {
                    return;
                }

                // Re-render
                var html = htmlCanvas();
                that.renderOn(html);

                // Replace our self
                that.asJQuery().replaceWith(html.root.element);
                that.triggerDidAttach();
            };

            /**
             * Evaluate `fn`, ensuring that an update will be
             * performed after evaluating the function. Nested calls
             * to `withUpdate` or `update` will result in updating the
             * widget only once.
             */
            that.withUpdate = function(fn) {
                if(inUpdateTransaction) {
                    fn();
                } else {
                    try {
                        inUpdateTransaction = true;
                        fn();
                    }
                    finally {
                        inUpdateTransaction = false;
                        that.update();
                    }
                }
            };

            // Third party protected extensions** added to `my`.
            // See widget-extensions.js
            for (var extProperty in ext) {
                if (ext.hasOwnProperty(extProperty)) {
                    my[extProperty] = ext[extProperty];
                }
            }

            return that;
        };

        /**
         * Creates unique ids used by widgets to identify their root div.
         */
        var idGenerator = (function () {
            var that = {};
            var id = 0;

            that.newId = function () {
                id += 1;
                return id.toString();
            };

            return that;
        })();

        return widget;
    }
);
