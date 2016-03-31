(function () {
    angular
        .module('datepickerLightModule', [])
        .service('datepickerLightService', datepickerLightService)
        .directive('angularDatePickerLight', datepickerLightDirective);

    datepickerLightDirective.$inject = ["$compile", "$document", "$window", "$timeout", "$templateRequest", "datepickerLightService"];
    function datepickerLightDirective($compile, $document, $window, $timeout, $templateRequest, datepickerLightService) {

        return {
            restrict: "A",
            scope: {
                options: '&angularDatePickerLight'
            },
            transclude: false,
            controllerAs: "ctrl",
            bindToController: true,
            require: ["angularDatePickerLight", "?ngModel"],
            link: postLinkFn,
            controller: MainCtrl
        }

        function postLinkFn(scope, element, attrs, ctrls) {
            var ctrl = ctrls[0]; //directive controller
            ctrl.textModelCtrl = ctrls[1]; // textbox model controller

            datepickerLightService.addDirectiveCtrl(ctrl);

            // execute the options expression in the parent scope
            var options = ctrl.options() || {};
            ctrl.init(angular.extend({}, defaultOptions, options));

            // store the jquery element on the controller          
            ctrl.target = element;

            $templateRequest("javascripts/templates/days-view.html")
                .then(function (template) {
                    initContainer(template);
                });

            function initContainer(template) {
                var templateFn = $compile(template);
                ctrl.container = templateFn(scope);

                if (angular.isDefined(ctrl.options.containerCssClass && ctrl.options.containerCssClass !== null)) {
                    ctrl.container.addClass(ctrl.options.containerCssClass);
                }

                // if inline == true append container after the textbox
                if (ctrl.options.inline === true) {
                    element.after(ctrl.container);
                }
                    // if a jquery parent is specified in options append the container
                else if (angular.isElement(ctrl.options.inline)) {
                    ctrl.options.inline.append(ctrl.container);
                    // else append container to body                    
                } else {
                    $document.find("body").append(ctrl.container);
                    ctrl.container.addClass("datepicker-absolute-container");
                }

                // prevents text select on mouse drag, dblclick
                ctrl.container.css("MozUserSelect", "none").bind("selectstart", function () {
                    return false;
                });

                // activate all inline date pickers
                if (ctrl.isInline()) {
                    ctrl.activate();
                }
            }

            // when the target(textbox) gets focus activate the corresponding container
            element.on("focus", function (e) {
                scope.$evalAsync(function () {
                    ctrl.activate();
                });
            });

            // when the target(textbox) changes
            element.on("keydown", function (e) {
                scope.$evalAsync(function () {
                    var term = element.val();
                    if (term.length === 0 || term === ctrl.targetText) {
                        return;
                    }

                    // wait few millisecs before trying to parse
                    // this allows checking if user has stopped typing
                    var delay = $timeout(function () {
                        // is term unchanged?
                        if (term == element.val()) {
                            ctrl.tryApplyDateFromTarget();
                        }

                        //cancel the timeout
                        $timeout.cancel(delay);
                    }, 300);
                });
            });

            angular.element($window).on("resize", function (e) {
                scope.$evalAsync(function () {
                    ctrl.hide();
                });
            })

            // hide container upon CLICK outside of the dropdown rectangle region
            $document.on("click", function (e) {
                scope.$evalAsync(function () {
                    _documentClick(e);
                });
            });

            // cleanup on destroy
            scope.$on('$destroy', function () {
                ctrl.empty();
                ctrl.container.remove();
            });

            function _documentKeyDown(e) {
                // hide inactive instances
                datepickerLightService.hideIfInactive();
            }

            function _documentClick(e) {
                // hide inactive dropdowns
                datepickerLightService.hideIfInactive();

                // we care about the active non-inline one only
                if (ctrl.instanceId !== ctrl.activeInstanceId() || ctrl.isInline()) {
                    return;
                }

                // hide the active calendar if user clicks anywhere away from the dropdown list
                var offset = ctrl.container[0].getBoundingClientRect();
                var isMouseAwayFromActiveContainer = false;
                var awayTolerance = 100;

                //check if mouse is over the container
                if (e.pageX < offset.left - awayTolerance
                    || e.pageX > offset.left + offset.width + awayTolerance
                    || e.pageY < offset.top - awayTolerance
                    || e.pageY > offset.top + offset.height + awayTolerance) {

                    isMouseAwayFromActiveContainer = true;

                    //check if mouse is over the target (textbox)
                    offset = ctrl.target[0].getBoundingClientRect();
                    if (e.pageX >= offset.left
                        && e.pageX <= offset.left + offset.width
                        && e.pageY >= offset.top
                        && e.pageY <= offset.top + offset.height) {

                        isMouseAwayFromActiveContainer = false;
                    }

                    if (isMouseAwayFromActiveContainer === true) {
                        ctrl.hide();
                    }
                }
            }
        }
    }

    MainCtrl.$inject = ["$window", "$document", "datepickerLightService"];
    function MainCtrl($window, $document, datepickerLightService) {
        var that = this;

        var activeInstanceId = 0,
            minDate,
            maxDate,
            calendarItems = [];

        var monthNamesLong = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
        //var monthNamesShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

        var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        this.target = null;
        this.targetText = null;

        this.containerVisible = false;
        this.validYears = [];

        this.todayDate = null;
        this.todayDateDisplay = null;
        this.selectedData = null;
        this.selectedMonth = null;
        this.selectedYear = null;

        this.dayNames = [];
        this.weeks = [];

        this.activeInstanceId = function () {
            return activeInstanceId;
        }

        // hide any open containers other than the active container
        this.hideIfInactive = function () {
            if (that.isInline()) {
                return;
            }

            // hide if this is not the active instance
            if (that.instanceId !== activeInstanceId) {
                that.hide();
            }
        }

        this.isInline = function () {
            // options.inline can be either true or a jquery object
            return that.options.inline === true
                || angular.isElement(that.options.inline);
        }


        this.init = function (options) {
            that.options = options;
            that.instanceId = ++instanceCount;

            var now = new Date();

            // set min and max date values
            // if not provided in options default minDate to 1/1 and maxDate to 12/31 of next year
            if (isUndefinedOrNull(that.options.minDate)) {
                minDate = null
            }
            else {
                minDate = parseDate(that.options.minDate);
            }
            if (minDate == null) {
                minDate = new Date(now.getFullYear(), 0, 1);
            }
            // maxdate
            if (isUndefinedOrNull(that.options.maxDate)) {
                maxDate = null
            }
            else {
                maxDate = parseDate(that.options.maxDate);
            }
            if (maxDate == null) {
                maxDate = new Date(now.getFullYear() + 1, 11, 31);
            }

            // create day names array starting at options.firstDayOfWeek
            var startIndex = that.options.firstDayOfWeek;
            // keep within valid range 0..6
            if (startIndex < 0 || startIndex > 6) {
                startIndex = that.options.firstDayOfWeek = 0;
            }
            while (that.dayNames.length < 7) {
                that.dayNames.push(dayNames[startIndex]);
                startIndex < 6 ? startIndex++ : startIndex = 0;
            }

            // create an object array of month names
            // a simple simple string array will not work with ng-options
            that.monthNames = [];
            for (i = 0; i <= 11; i++) {
                that.monthNames.push({
                    index: i,
                    name: monthNamesLong[i]
                });
            }

            // if 'now' is outside valid date range default to minDate
            if (isDateInRange(now)) {
                that.todayDate = now;
            }
            else {
                that.todayDate = minDate;
            }

            that.todayDateDisplay = formatDate(now, "ddd MMM DD YYYY");

            // default to todays date upon initialize
            that.selectedMonth = that.todayDate.getMonth();
            that.selectedYear = that.todayDate.getFullYear();
            that.selectedData = getCellData(that.todayDate);

            buildCalendar();

            // build years array
            for (i = minDate.getFullYear() ; i <= maxDate.getFullYear() ; i++) {
                that.validYears.push(i);
            }
        }

        this.tryApplyDateFromTarget = function () {
            if (that.textModelCtrl === null) {
                return;
            }

            that.targetText = that.textModelCtrl.$viewValue;
            var date = parseDate(that.targetText);

            // if date is valid and in range build calendar if needed
            if (date !== null && isDateInRange(date)) {
                // sets the that.selectedMonth and that.selectedYear if different
                var updated = setMonthYear(date);

                // build calendar only if month or year changed
                if (updated === true) {
                    buildCalendar();
                }

                applySelection(date, true);
            }
        }

        this.activate = function () {
            activeInstanceId = that.instanceId;

            that.tryApplyDateFromTarget();

            that.show();
        }


        this.monthChange = function () {
            buildCalendar();

            safeCallback(that.options.monthYearChanged, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }

        this.yearChange = function () {
            buildCalendar();

            safeCallback(that.options.monthYearChanged, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }


        this.gotoPreviousMonth = function (month, year) {
            var my = getPreviousMonthYear(month, year);

            that.selectedMonth = my.month;
            that.selectedYear = my.year;

            buildCalendar();

            safeCallback(that.options.monthYearChange, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }

        this.gotoNextMonth = function (month, year) {
            var my = getNextMonthYear(month, year);

            that.selectedMonth = my.month;
            that.selectedYear = my.year;

            buildCalendar();

            safeCallback(that.options.monthYearChange, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }


        this.dateCellCssClass = function (cellData) {
            var css = {};

            var dateVisible = that.isDateVisible(cellData.date);

            css[that.options.dateVisibleCssClass] = dateVisible;
            css[that.options.dateOtherMonthCssClass] = dateVisible && that.isOtherMonth(cellData.date);
            css[that.options.dateSelectedCssClass] = dateVisible && that.isDateSelected(cellData.date);
            css[that.options.dateDisabledCssClass] = dateVisible && (cellData.enabled === false);

            // custom css class added in callback
            if (!isUndefinedOrNull(cellData.cssClass)) {
                css[cellData.cssClass] = true;
            }

            return css;
        }

        this.dateDisplay = function (cellData) {
            return formatDate(cellData.date, 'DD');
        }

        this.dateSelect = function (cellData) {
            // sets the that.selectedMonth and that.selectedYear if different
            // this is required if the selected date belongs to other month
            var updated = setMonthYear(cellData.date);

            // build calendar only if month or year changed
            if (updated === true) {
                buildCalendar();
            }

            applySelection(cellData.date);

            that.hide();
        }

        this.todayDateSelect = function () {
            // if date is not in range, do not select and do not hide
            if (!isDateInRange(that.todayDate)) {
                return;
            }

            // sets the that.selectedMonth and that.selectedYear if different
            var updated = setMonthYear(that.todayDate);

            // build calendar only if month or year changed
            if (updated === true) {
                buildCalendar();
            }

            applySelection(that.todayDate);

            that.hide();
        }


        this.show = function () {
            // position calendar if not displayed inline
            if (!that.isInline()) {
                // the textbox position can change (ex: window resize)
                // so reposition the datepicker before it's shown
                positionDatePicker();
            }

            that.containerVisible = true;

            // callback
            safeCallback(that.options.datepickerShown);
        }

        this.hide = function () {
            // do not hide if displayed inline
            if (that.isInline()) {
                return;
            }

            // exit if already hidden
            if (that.containerVisible === false) {
                return;
            }

            that.containerVisible = false;

            // callback
            safeCallback(that.options.datepickerHidden);
        }


        this.isDateVisible = function (date) {
            // if date is from previous/next month show/hide as set in options
            if (date.getMonth() !== that.selectedMonth) {
                if (that.options.showOtherMonthDates === true) {
                    return true;
                }

                return false;
            }

            return true;
        }

        this.isOtherMonth = function (date) {
            return date.getMonth() !== that.selectedMonth;
        }

        this.isDateSelected = function (date) {
            if (!isUndefinedOrNull(that.selectedData) && angular.isObject(that.selectedData)) {
                return areDatesEqual(date, that.selectedData.date);
            }

            return false;
        }

        this.isDateEnabled = function (date) {
            var cellData = calendarItems.find(function (cellData) {
                return areDatesEqual(cellData.date, date);
            });

            // object exists?
            if (!isUndefinedOrNull(cellData)) {
                return cellData.enabled === true;
            }

            // cell data with given date not found
            return false;
        }


        function getPreviousMonthYear(month, year) {
            var monthCopy = month,
                yearCopy = year;

            if (month > 0) {
                month--;
            } else if (month === 0) {
                month = 11;
                year--;
            }

            // restrict based on min date
            // adjust month to 1-based because format date returns month as 1-based
            var monthPlusOne = month + 1;
            var leadingZero = monthPlusOne < 10 ? "0" : "";
            if (parseInt(year + "" + leadingZero + monthPlusOne) < parseInt(formatDate(minDate, 'YYYYMM'))) {
                return {
                    month: monthCopy,
                    year: yearCopy
                };
            }

            return {
                month: month,
                year: year
            };
        }

        function getNextMonthYear(month, year) {
            var monthCopy = month,
                yearCopy = year;

            if (month < 11) {
                month++;
            } else if (month === 11) {
                month = 0;
                year++;
            }

            // restrict based on max date
            // adjust month to 1-based because format date returns month as 1-based
            var monthPlusOne = month + 1;
            var leadingZero = monthPlusOne < 10 ? "0" : "";
            if (parseInt(year + "" + leadingZero + monthPlusOne) > parseInt(formatDate(maxDate, 'YYYYMM'))) {
                return {
                    month: monthCopy,
                    year: yearCopy
                };
            }

            return {
                month: month,
                year: year
            };
        }

        // sets that.selectedMonth and that.selectedYear if different
        // return true if the properties were set
        function setMonthYear(date) {
            var month = date.getMonth();
            var year = date.getFullYear();

            // update properties if different
            if (month !== that.selectedMonth || year !== that.selectedYear) {
                that.selectedMonth = month;
                that.selectedYear = year;

                return true;
            }

            return false;
        }

        // maybe there is a better way to do this
        // 1. start counting the days from the left side (firstDayOfWeek)
        // 2. increment firstDayOfWeek to mimic moving towards the right side (firstDayOfMonth)
        // 3. if firstDayOfWeek becomes > 6 reset to 0
        // continue until firstDayOfWeek === firstDayOfMonth
        function getDaysBeforeFirstDayOfMonth(firstDayOfWeek, firstDayOfMonth) {
            if (firstDayOfMonth === firstDayOfWeek
                || firstDayOfMonth < 0 || firstDayOfMonth > 6
                || firstDayOfWeek < 0 || firstDayOfWeek > 6) {

                return;
            }

            var daysBefore = 0;

            while (firstDayOfWeek !== firstDayOfMonth) {
                daysBefore++;

                firstDayOfWeek++;
                if (firstDayOfWeek > 6) {
                    firstDayOfWeek = 0;
                }
            }

            return daysBefore;
        }

        // build the calendar array
        function buildCalendar() {
            var year = that.selectedYear;
            var month = that.selectedMonth;

            var firstDateOfMonth = getDate(year, month, 1);
            var firstDayOfMonth = firstDateOfMonth.getDay();
            var firstDayOfWeek = that.options.firstDayOfWeek;

            var rowIndex = 0,
                datesInWeek = 0,
                date = 1;

            calendarItems = [];
            that.weeks = [];

            // if first day of month != firstDayOfWeek then start dates from prior month
            if (firstDayOfWeek != firstDayOfMonth) {
                var daysBefore = getDaysBeforeFirstDayOfMonth(firstDayOfWeek, firstDayOfMonth);
                if (!isUndefinedOrNull(daysBefore)) {
                    // 0 is one day prior; 1 is two days prior and so forth
                    date = date - daysBefore;
                }
            }

            while (date <= getDaysInMonth(year, month)) {
                calendarItems.push(getCellData(getDate(year, month, date++)));
            }

            // fill remaining cells with dates from next month
            while ((calendarItems.length % 7) !== 0) {
                calendarItems.push(getCellData(getDate(year, month, date++)));
            }

            // populate the that.weeks array. create a 2D array of 7 days per row
            angular.forEach(calendarItems, function (cellData) {
                if ((datesInWeek % 7) === 0) {
                    that.weeks.push([]);
                    rowIndex = that.weeks.length - 1;
                }

                that.weeks[rowIndex].push(cellData);

                datesInWeek++;
            });

            //raise the callback for each cell data
            raiseRenderDateCallback(calendarItems);
        }

        function raiseRenderDateCallback(cellDataCollection) {
            // raise the callback for each date
            angular.forEach(cellDataCollection, function (cellData) {
                // if date is outside min/max date range set to disable.
                // do not callback for dates outside range
                if (!isDateInRange(cellData.date)) {
                    cellData.enabled = false;
                    return;
                }

                // callback for each date
                var cbRetVal = safeCallback(that.options.renderDate, { date: cellData.date });

                // pass an empty literal in case nothing was returned from callback
                copySupportedProperties(cbRetVal || {}, cellData);
            });
        }

        function copySupportedProperties(cbRetVal, cellData) {
            // if callbackArgs.enabled is undefined default to true
            if (isUndefinedOrNull(cbRetVal.enabled)) {
                cellData.enabled = true;
            }
            else {
                cellData.enabled = cbRetVal.enabled;
            }

            // in order to set selected = true, enabled must also be true
            if (cbRetVal.selected === true && cellData.enabled === true) {
                cellData.selected = true;
            }
            else {
                cellData.selected = cbRetVal.selected;
            }

            // css class to apply to the date <td>
            cellData.cssClass = cbRetVal.cssClass

            // arbitrary custom data to store with date
            cellData.data = cbRetVal.data;

            // tooltip for the date <td>
            cellData.tooltip = cbRetVal.tooltip;
        }

        function postRenderDateCallback(dateToSelect) {
            // after the renderDate callbacks find the object with cellData.selected == true.
            // this might have been set on the cellData during callback
            var selectedCellData = calendarItems.find(function (cellData) {
                // must be enabled to be able to select
                return cellData.selected === true && cellData.enabled === true;
            });

            // if no object exists with 'selected' = true perform the following:
            // 1. if 'dateToSelect' is provided find the cell data with that date
            // 2. select the cellData if it exists and the selected property is not set
            if (isUndefinedOrNull(selectedCellData)) {
                if (angular.isDate(dateToSelect)) {
                    var cellData = calendarItems.find(function (cellData) {
                        // must be enabled to be able to select
                        return areDatesEqual(cellData.date, dateToSelect)
                            && cellData.enabled === true;
                    });

                    // set 'selected' to true only if its undefined/null
                    if (angular.isObject(cellData) && isUndefinedOrNull(cellData.selected)) {
                        selectedCellData = cellData;
                    }
                }
            }

            return selectedCellData;
        }


        function getDate(year, month, day) {
            return new Date(year, month, day);
        }

        function getDaysInMonth(year, month) {
            return moment().year(year).month(month).daysInMonth();
        }

        function getCellData(date) {
            return {
                date: date,
                enabled: true,
                selected: angular.undefined,
                tooltip: angular.undefined,
                cssClass: angular.undefined,
                data: angular.undefined,
            }
        }


        function applySelection(dateToSelect, updatingFromTarget) {
            var cellData = postRenderDateCallback(dateToSelect);

            if (isUndefinedOrNull(cellData)) {
                return;
            }

            // do not select if disabled
            if (cellData.enabled === false) {
                return;
            }

            var cbRetVal = safeCallback(that.options.beforeDateSelect, { date: cellData.date, cancel: false, data: cellData.data });

            // cancel selection if set to true from callback
            if (!isUndefinedOrNull(cbRetVal) && cbRetVal.cancel === true) {
                return;
            }

            that.selectedMonth = cellData.date.getMonth();
            that.selectedYear = cellData.date.getFullYear();
            that.selectedData = cellData;

            if (updatingFromTarget !== true) {
                updateTargetModel(formatDate(that.selectedData.date));
            }

            safeCallback(that.options.dateSelected, { date: cellData.date, data: cellData.data });
        }


        function parseDate(value) {
            var mom = moment(value, that.options.dateFormat);
            if (!mom.isValid()) {
                return null;
            }

            return mom.toDate();
        }

        function formatDate(date, format) {
            var mom = moment(date);

            if (!mom.isValid()) {
                return;
            }

            // use the format argument if provided
            if (angular.isString(format)) {
                return mom.format(format);
            }

            return mom.format(that.options.dateFormat);
        }

        function isDateInRange(date) {
            var momDate = moment(date);

            var momMinDate = moment(minDate);
            var momMaxDate = moment(maxDate);

            return momDate.isSameOrAfter(momMinDate, 'd')
                && momDate.isSameOrBefore(momMaxDate, 'd');
        }

        function areDatesEqual(date1, date2) {
            return moment(date1).isSame(moment(date2), 'day');
        }

        function isUndefinedOrNull(value) {
            return (angular.isUndefined(value) || value === null);
        }


        function safeCallback(fn, args) {
            if (angular.isFunction(fn)) {
                try {
                    return fn.call(that.target, args);
                } catch (e) {
                    //ignore
                }
            }
        }

        function positionDatePicker() {
            if (that.isInline()) {
                return;
            }

            var rect = that.target[0].getBoundingClientRect();

            // use the .position() function from jquery.ui if available
            // requires both jquery and jquery-ui to be loaded
            if (window.jQuery && window.jQuery.ui) {
                var pos = {
                    my: "left top",
                    at: "left bottom",
                    of: that.target,
                    collision: "none flip"
                };

                if (!isUndefinedOrNull(that.options.positionUsing) && angular.isObject(that.options.positionUsing)) {
                    pos = that.options.positionUsing;
                }

                that.container.position(pos);
            } else {
                var scrollTop = $document[0].body.scrollTop || $document[0].documentElement.scrollTop || $window.pageYOffset,
                    scrollLeft = $document[0].body.scrollLeft || $document[0].documentElement.scrollLeft || $window.pageXOffset;

                that.container.css({
                    "left": rect.left + scrollLeft + "px"
                });
                that.container.css({
                    "top": rect.top + rect.height + scrollTop + 3 + "px"
                });
            }
        }

        function updateTargetModel(modelValue) {
            if (that.textModelCtrl === null) {
                return;
            }

            // update only if different from current value
            if (modelValue !== that.textModelCtrl.$modelValue) {
                that.textModelCtrl.$setViewValue(modelValue);
                that.textModelCtrl.$render();

                targetValue = modelValue;
            }
        }


        datepickerLightService.defaultOptionsDoc = function () {
            return defaultOptionsDoc;
        }
    }

    function datepickerLightService() {
        var directiveCtrls = [];

        this.addDirectiveCtrl = function (ctrl) {
            if (ctrl) {
                directiveCtrls.push(ctrl);
            }
        }

        this.hideIfInactive = function (ctrl) {
            angular.forEach(directiveCtrls, function (value) {
                value.hideIfInactive();
            });
        }
    }


    var instanceCount = 0;

    var defaultOptions = {
        altTarget: null,
        inline: false,
        dateFormat: 'MM/DD/YYYY',
        minDate: null,
        maxDate: null,
        firstDayOfWeek: 0,
        showOtherMonthDates: false,
        //css class
        containerCssClass: undefined,
        dateVisibleCssClass: "date-visible",
        dateSelectedCssClass: "date-selected",
        dateOtherMonthCssClass: "date-other-month",
        dateDisabledCssClass: "date-disabled",
        //callback
        datepickerShown: angular.noop,
        datepickerHidden: angular.noop,
        renderDate: angular.noop,
        beforeDateSelect: angular.noop,
        dateSelected: angular.noop,
        monthYearChanged: angular.noop
    };

    var defaultOptionsDoc = {
        containerCssClass: {
            def: "undefined",
            doc: "CSS class applied to the dropdown container"
        },
        dateSelectedCssClass: {
            def: "date-selected",
            doc: "CSS class applied to the selected date cell"
        },
        minimumChars: {
            def: "1",
            doc: "Minimum number of characters required to display the dropdown."
        },
        maxItemsToRender: {
            def: "20",
            doc: "Maximum number of items to render in the list."
        },
        dropdownWidth: {
            def: "auto",
            doc: "Width in 'px' of the dropddown list."
        },
        dropdownHeight: {
            def: "auto",
            doc: "Height in 'px' of the dropddown list."
        },
        dropdownParent: {
            def: "undefined",
            doc: "a jQuery object to append the dropddown list."
        },
        loading: {
            def: "noop",
            doc: "Callback before getting the data for the dropdown."
        },
        data: {
            def: "noop",
            doc: "Callback for data for the dropdown. Must return a promise"
        },
        loadingComplete: {
            def: "noop",
            doc: "Callback after the items are rendered in the dropdown."
        },
        renderItem: {
            def: "noop",
            doc: "Callback for custom rendering a list item. This is called for each item in the dropdown. It must return an object literal with 'value' and 'label' properties, where label is the safe html for display and value is the text for the textbox"
        },
        itemSelected: {
            def: "noop",
            doc: "Callback after an item is selected from the dropdown."
        },
        dropdownShown: {
            def: "noop",
            doc: "Callback after the dropdown is hidden."
        },
        dropdownHidden: {
            def: "noop",
            doc: "Callback after the dropdown is shown."
        }
    };

})();
