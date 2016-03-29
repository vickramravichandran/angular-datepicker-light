(function() {
    angular
        .module('datePickerModule', [])
        .service('datePickerService', datePickerService)
        .directive('angularDatePicker', datePickerDirective);

    datePickerDirective.$inject = ["$compile", "$document", "$window", "$timeout", "$templateRequest", "datePickerService"];
    function datePickerDirective($compile, $document, $window, $timeout, $templateRequest, datePickerService) {

        return {
            restrict: "A",
            scope: {
                options: '&angularDatePicker'
            },
            transclude: false,
            controllerAs: "ctrl",
            bindToController: true,
            require: ["angularDatePicker", "?ngModel"],
            link: postLinkFn,
            controller: MainCtrl
        }

        function postLinkFn(scope, element, attrs, ctrls) {
            var ctrl = ctrls[0]; //directive controller
            ctrl.textModelCtrl = ctrls[1]; // textbox model controller

            datePickerService.addDirectiveCtrl(ctrl);

            // execute the options expression in the parent scope
            var options = ctrl.options() || {};
            ctrl.init(angular.extend({}, defaultOptions, options));

            $templateRequest("javascripts/templates/days-view.html")
                .then(function(template) {
                    initContainer(template);
                });

            function initContainer(template) {
                var templateFn = $compile(template);
                ctrl.container = templateFn(scope);

                if (angular.isDefined(ctrl.options.containerCssClass)) {
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
                    ctrl.container.addClass("date-picker-absolute-container");
                }

                // store the jquery element on the controller          
                ctrl.target = element;

                // prevents text select on mouse drag, dblclick
                ctrl.container.css("MozUserSelect", "none").bind("selectstart", function() {
                    return false;
                });

                // activate all inline date pickers
                if (ctrl.isInline()) {
                    ctrl.activate();
                }
            }

            // when the target(textbox) gets focus activate the corresponding container
            element.on("focus", function(e) {
                scope.$evalAsync(function() {
                    ctrl.activate();
                });
            });

            // when the target(textbox) changes
            element.on("keydown", function(e) {
                scope.$evalAsync(function() {
                    var term = element.val();
                    if (term.length === 0 || term === ctrl.targetText) {
                        return;
                    }

                    // wait few millisecs before trying to parse
                    // this allows checking if user has stopped typing
                    var delay = $timeout(function() {
                        // is term unchanged?
                        if (term == element.val()) {
                            ctrl.applyDateFromTarget();
                        }

                        //cancel the timeout
                        $timeout.cancel(delay);
                    }, 300);
                });
            });

            //            angular.element($window).on("resize", function (e) {
            //                scope.$evalAsync(function () {
            //                    ctrl.hide();
            //                });
            //            })

            // hide container upon CLICK outside of the dropdown rectangle region
            $document.on("click", function(e) {
                scope.$evalAsync(function() {
                    _documentClick(e);
                });
            });

            // cleanup on destroy
            scope.$on('$destroy', function() {
                ctrl.empty();
                ctrl.container.remove();
            });

            function _documentKeyDown(e) {
                // hide inactive instances
                datePickerService.hideIfInactive();
            }

            function _documentClick(e) {
                // hide inactive dropdowns
                datePickerService.hideIfInactive();

                // we care about the active non-inline one only
                if (ctrl.instanceId !== ctrl.activeInstanceId() || ctrl.isInline()) {
                    return;
                }

                // hide the active calendar if user clicks anywhere away from the dropdown list
                var isMouseAwayFromActiveContainer = false;
                var awayTolerance = 100;
                var offset = ctrl.container[0].getBoundingClientRect();

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

    MainCtrl.$inject = ["$q", "$window", "$document", "$sce", "datePickerService"];
    function MainCtrl($q, $window, $document, $sce, datePickerService) {
        var that = this;

        var activeInstanceId = 0,
            minDate,
            maxDate,
            cellDataArray = [];

        var monthNamesLong = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
        //var monthNamesShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

        this.dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        this.containerVisible = false;
        this.validYears = [];

        this.todayDate = null;
        this.todayDateDisplay = null;
        this.selectedData = null;
        this.selectedMonth = null;
        this.selectedYear = null;
        this.targetText = null;
        this.weeks = [];

        this.activeInstanceId = function() {
            return activeInstanceId;
        }

        // hide any open containers other than the active container
        this.hideIfInactive = function() {
            if (that.isInline()) {
                return;
            }

            // hide if this is not the active instance
            if (that.instanceId !== activeInstanceId) {
                that.hide();
            }
        }

        this.isInline = function() {
            // options.inline can be either true or a jquery object
            return that.options.inline === true
                || angular.isElement(that.options.inline);
        }


        this.init = function(options) {
            that.options = options;
            that.instanceId = ++instanceCount;

            var now = new Date();

            // set min and max date
            // if not provided in options then default
            // minDate to 1/1 and maxDate to 12/31 of current year
            minDate = parseDate(that.options.minDate);
            if (minDate == null) {
                minDate = new Date(now.getFullYear(), 0, 1);
            }
            maxDate = parseDate(that.options.maxDate);
            if (maxDate == null) {
                maxDate = new Date(now.getFullYear(), 11, 31);
            }

            // object array of month names.
            // had to do this because ng-options require an array of objects not strings
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

            // build years array
            for (i = minDate.getFullYear(); i <= maxDate.getFullYear(); i++) {
                that.validYears.push(i);
            }
        }

        this.applyDateFromTarget = function() {
            if (that.textModelCtrl === null) {
                return;
            }

            that.targetText = that.textModelCtrl.$viewValue;
            var date = parseDate(that.targetText);

            // if date is valid and in range build calendar if needed
            if (date !== null && isDateInRange(date)) {
                buildCalendarIfRequired(date);
            }
        }

        this.activate = function() {
            activeInstanceId = that.instanceId;

            that.applyDateFromTarget();

            buildCalendar();

            that.show();
        }


        this.monthChange = function() {
            buildCalendar();

            _safeCallback(that.options.monthYearChanged, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }

        this.yearChange = function() {
            buildCalendar();

            _safeCallback(that.options.monthYearChanged, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }


        this.gotoPreviousMonth = function(month, year) {
            var my = getPreviousMonthYear(month, year);

            that.selectedMonth = my.month;
            that.selectedYear = my.year;

            buildCalendar();

            _safeCallback(that.options.monthYearChange, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }

        this.gotoNextMonth = function(month, year) {
            var my = getNextMonthYear(month, year);

            that.selectedMonth = my.month;
            that.selectedYear = my.year;

            buildCalendar();

            _safeCallback(that.options.monthYearChange, {
                month: that.selectedMonth,
                year: that.selectedYear
            });
        }


        this.dateCellCssClass = function(cellData) {
            var css = {};

            var dateVisible = that.isDateVisible(cellData.date);

            css[that.options.dateVisibleCssClass] = dateVisible;
            css[that.options.dateOtherMonthCssClass] = dateVisible && that.isOtherMonth(cellData.date);
            css[that.options.dateSelectedCssClass] = dateVisible && that.isDateSelected(cellData.date);
            css[that.options.dateDisabledCssClass] = dateVisible && (cellData.enabled === false);

            return css;
        }

        this.dateDisplay = function(cellData) {
            return formatDate(cellData.date, 'DD');
        }

        this.dateSelect = function(cellData) {
//            // do not select if disabled
//            if (cellData.enabled === false) {
//                return;
//            }

            // rebuild if the current month or year do not match today
            buildCalendarIfRequired(cellData.date);

            applySelection(cellData);

            that.hide();
        }

        this.todayDateSelect = function() {
            // if date is not in range, do not select and do not hide
            if (isDateInRange(that.todayDate)) {
                // rebuild if the current month or year do not match today
                buildCalendarIfRequired(that.todayDate);

                applySelection(getCellData(that.todayDate));
                
                that.hide();
            }
//            else {
//                that.selectedMonth = that.todayDate.getMonth();
//                that.selectedYear = that.todayDate.getFullYear();
//
//                buildCalendar();
//            }
        }


        this.show = function() {
            // position calendar if not displayed inline
            if (!that.isInline()) {
                // the textbox position can change (ex: window resize)
                // so reposition the datepicker before it's shown
                positionDatePicker();
            }

            that.containerVisible = true;

            // callback
            _safeCallback(that.options.datePickerShown);
        }

        this.hide = function() {
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
            _safeCallback(that.options.datePickerHidden);
        }


        this.isDateVisible = function(date) {
            // if date is from previous/next month show/hide as set in options
            if (date.getMonth() !== that.selectedMonth) {
                if (that.options.showOtherMonthDates === true) {
                    return true;
                }

                return false;
            }

            return true;
        }

        this.isOtherMonth = function(date) {
            return date.getMonth() !== that.selectedMonth;
        }

        this.isDateSelected = function(date) {
            if (that.selectedData !== null && angular.isObject(that.selectedData)) {
                return areDatesEqual(date, that.selectedData.date);
            }

            return false;
        }
        
        this.isDateEnabled = function(date) {
            var cellData = cellDataArray.find(function(cellData){
                return areDatesEqual(cellData.date, date);
            });
            
            // object exists?
            if (angular.isDefined(cellData))
            {
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


        function buildCalendarIfRequired(date) {
            // rebuild if the current month or year do not match today
            if (date.getMonth() !== that.selectedMonth || date.getFullYear() !== that.selectedYear) {
                that.selectedMonth = date.getMonth();
                that.selectedYear = date.getFullYear();

                buildCalendar(date);
            }
        }

        //build the calendar and select 'dateToSelect' date
        function buildCalendar(dateToSelect) {
            var year = that.selectedYear;
            var month = that.selectedMonth;

            var firstDateOfMonth = getDate(year, month, 1);
            var firstDayOfMonth = firstDateOfMonth.getDay();
            var dayOfWeekStart = that.options.dayOfWeekStart;

            var rowIndex = 0,
                datesInWeek = 0,
                date = 1;

            cellDataArray = [];
            that.weeks = [];

            // if first day of month != dayOfWeekStart then start dates from prior month
            if (firstDayOfMonth != dayOfWeekStart) {
                date = 1 - firstDayOfMonth;
            }

            while (date <= getDaysInMonth(year, month)) {
                cellDataArray.push(getCellData(getDate(year, month, date++)));
            }

            // fill remaining cells with dates from next month
            while ((cellDataArray.length % 7) !== 0) {
                cellDataArray.push(getCellData(getDate(year, month, date++)));
            }

            //raise the callback for each cell data
            raiseRenderDateCallback(cellDataArray)

            // after the renderDate callbacks find the object with cellData.selected == true.
            // this might have been set on the cellData during callback
            var selectedCellData = cellDataArray.find(function(cellData) {
                // must be enabled to be able to select
                return cellData.selected === true && cellData.enabled === true;
            });

            // if no object exists with 'selected' = true perform the following:
            // 1. if 'dateToSelect' is provided find the cell data with that date
            // 2. if cellData exists and the selected property is undefined (not set) set it to selected
            if (angular.isUndefined(selectedCellData)) {
                if (angular.isDate(dateToSelect)) {
                    var cellData = cellDataArray.find(function(cellData) {
                        // must be enabled to be able to select
                        return areDatesEqual(cellData.date, dateToSelect) 
                            && cellData.enabled === true;
                    });

                    // set 'selected' to true only if its undefined
                    if (angular.isObject(cellData) && angular.isUndefined(cellData.selected)) {
                        selectedCellData = cellData;
                    }
                }
            }

            // populate the that.weeks array. create a 2D array of 7 days per row
            angular.forEach(cellDataArray, function(cellData) {
                if ((datesInWeek % 7) === 0) {
                    that.weeks.push([]);
                    rowIndex = that.weeks.length - 1;
                }

                that.weeks[rowIndex].push(cellData);

                datesInWeek++;
            });

            // apply selection if selected cell data is available
            if (angular.isObject(selectedCellData)) {
                applySelection(selectedCellData);
            }
        }

        function raiseRenderDateCallback(cellDataCollection) {
            // raise the callback for each date
            angular.forEach(cellDataCollection, function(cellData) {
                // if date is outside min/max date range set to disable.
                // do not callback for dates outside range
                if (!isDateInRange(cellData.date)) {
                    cellData.enabled = false;
                    return;
                }

                // callback
                var callbackArgs = { date: cellData.date };
                _safeCallback(that.options.renderDate, callbackArgs);

                copySupportedProperties(callbackArgs, cellData);
            });
        }

        function copySupportedProperties(callbackArgs, cellData) {
            // if callbackArgs.enabled is undefined default to true
            if (angular.isUndefined(callbackArgs.enabled)) {
                cellData.enabled = true;
            }
            else {
                cellData.enabled = callbackArgs.enabled;
            }

            // in order to set selected = true, enabled must also be true
            if (callbackArgs.selected === true && cellData.enabled === true) {
                cellData.selected = true;
            }
            else {
                cellData.selected = callbackArgs.selected;
            }
            
            cellData.tooltip = callbackArgs.tooltip;
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
                tooltip: angular.undefined
            }
        }


        function applySelection(cellData) {
            if (cellData === null || !angular.isObject(cellData)) {
                return;
            }
            
            // do not select if disabled
            if (cellData.enabled === false) {
                return;
            }

            cellData.selected = true;

            that.selectedMonth = cellData.date.getMonth();
            that.selectedYear = cellData.date.getFullYear();
            that.selectedData = cellData;

            updateTargetModel(formatDate(that.selectedData.date));

            _safeCallback(that.options.dateSelected, cellData);
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


        function _safeCallback(fn, args) {
            if (angular.isFunction(fn)) {
                try {
                    fn(args);
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
                that.container.position({
                    my: "left top",
                    at: "left bottom",
                    of: that.target,
                    collision: "none flip"
                });
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


        datePickerService.defaultOptionsDoc = function() {
            return defaultOptionsDoc;
        }
    }

    function datePickerService() {
        var directiveCtrls = [];

        this.addDirectiveCtrl = function(ctrl) {
            if (ctrl) {
                directiveCtrls.push(ctrl);
            }
        }

        this.hideIfInactive = function(ctrl) {
            angular.forEach(directiveCtrls, function(value) {
                value.hideIfInactive();
            });
        }
    }


    var instanceCount = 0;

    var defaultOptions = {
        altTarget: null,
        inline: false,
        dateFormat: 'MM/DD/YYYY',
        minDate: "01/01/2016",
        maxDate: "12/31/2020",
        dayOfWeekStart: 0,
        showOtherMonthDates: false,
        positionUsing: null,
        //css class
        containerCssClass: undefined,
        dateVisibleCssClass: "date-visible",
        dateSelectedCssClass: "date-selected",
        dateOtherMonthCssClass: "date-other-month",
        dateDisabledCssClass: "date-disabled",
        //callback
        datePickerShown: angular.noop,
        datePickerHidden: angular.noop,
        renderDate: angular.noop,
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
