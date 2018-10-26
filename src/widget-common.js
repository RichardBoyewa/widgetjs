define([
], () => {
	/**
	 * Creates unique ids used by widgets to identify their root div.
	 */
	var idGenerator = (function() {
		var that = {};
		var id = 0;

		that.newId = function() {
			id += 1;
			return id.toString();
		};

		return that;
	})();

	/**
	 * Helpers for keeping track of the currently rendered widget.
	 */
	var currentWidget = (function() {
		var current;
		return {
			get: function() {
				return current;
			},
			set: function(widget) {
				current = widget;
			}
		};
	})();

	/**
	 * Return true if the parent widget is rendering the receiver.
	 */
	function inRenderingLoop() {
		return !!currentWidget.get();
	}

	/**
	 * Set `widget` as the current widget while evaluating `fn`.
	 */
	function withCurrentWidget(fn, widget) {
		var current = currentWidget.get();
		try {
			currentWidget.set(widget);
			fn();
		} finally {
			currentWidget.set(current);
		}
	}

	return {
		idGenerator,
		currentWidget,
		inRenderingLoop,
		withCurrentWidget
	};
});
