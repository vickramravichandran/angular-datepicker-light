(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        // commonJS
        module.exports = factory(require('angular'), require('moment'));
    }
    else if (typeof define === 'function' && define.amd) {
        // AMD
        define(['module', 'angular', 'moment'], function (module, angular, moment) {
            module.exports = factory(angular, moment);
        });
    }
    else {
        factory(global.angular, global.moment);
    }
}(this, function (angular, moment) {

    angular
        .module('datepickerLightModule', [])
        .service('datepickerLightService', datepickerLightService)
        .directive('angularDatepickerLight', datepickerLightDirective);

    // polyfill for Array.prototype.find
    if (!angular.isFunction(Array.prototype.find)) {
        Array.prototype.find = function (callback) {
            var that = this;

            var found;
            for (var i = 0; i < that.length; i++) {
                var item = that[i];

                if (callback(item) === true) {
                    found = item;
                    break;
                }
            }

            return found;
        }
    }

    datepickerLightDirective.$inject = ["$compile", "$document", "$window", "$timeout", "$templateRequest", "datepickerLightService"];
    function datepickerLightDirective($compile, $document, $window, $timeout, $templateRequest, datepickerLightService) {

        return {
            restrict: "A",
            scope: {
                options: '&angularDatepickerLight'
            },
            transclude: false,
            controllerAs: "ctrl",
            bindToController: true,
            require: ["angularDatepickerLight", "?ngModel"],
            link: postLinkFn,
            controller: MainCtrl
        }

        function postLinkFn(scope, element, attrs, ctrls) {
            var ctrl = ctrls[0]; //directive controller
            ctrl.textModelCtrl = ctrls[1]; // textbox model controller

            datepickerLightService.addDirectiveCtrl(ctrl);

            // execute the options expression in the parent scope
            var options = ctrl.options() || {
            };
            ctrl.init(angular.extend({
            }, defaultOptions, options));

            // store the jquery element on the controller
            ctrl.target = element;

            if(ctrl.isUiSelectEnabled())
                initContainer(html_uiselect);
            else
                initContainer(html);

            function initContainer(template) {
                var templateFn = $compile(template);
                ctrl.container = templateFn(scope);

                if (angular.isDefined(ctrl.options.containerCssClass && ctrl.options.containerCssClass !== null)) {
                    ctrl.container.addClass(ctrl.options.containerCssClass);
                }

                // if a jquery parent is specified in options append the container
                if (angular.isElement(ctrl.options.inline)) {
                    ctrl.options.inline.append(ctrl.container);

                    // else append container after the textbox
                } else {
                    element.after(ctrl.container);
                }

                // if container is not inline, than make its position absolute
                if (!ctrl.isInline()) {
                    ctrl.container.addClass("datepicker-absolute-container");
                }

                if(ctrl.hideTodayDateEnabled()) {
                    angular.element(".bottom-panel").addClass("hide-container")
                }


                // if a jquery altTarget is specified in options append the container
                // altTarget supported only for non-inline
                if (!ctrl.isInline() && angular.isElement(ctrl.options.altTarget)) {
                    // focus the textbox when the alt target(ex: image icon) is clicked
                    ctrl.options.altTarget.on("click focus", function (e) {
                        scope.$evalAsync(function () {
                            ctrl.activate();
                        });
                    });
                }

                // if a jquery altTarget is specified in options append the container
                // altTarget supported only for non-inline
                if (!ctrl.isInline() && angular.isElement(ctrl.options.toggleTarget)) {
                    // focus the textbox when the alt target(ex: image icon) is clicked
                    ctrl.options.toggleTarget.on("click focus", function (e) {
                        scope.$evalAsync(function () {
                            ctrl.toggleShow();
                        });
                    });
                }

                // prevents text select on mouse drag, dblclick
                ctrl.container.css("MozUserSelect", "none").bind("selectstart", function () {
                    return false;
                });
            }

            $document.ready(function(){
                // activate all inline date pickers and call ready callback
                scope.$evalAsync(function () {
                    if (ctrl.isInline()) {
                        ctrl.activate();
                    }

                    ctrl.ready();
                });
            })

            // when the target(textbox) gets focus activate the corresponding container
            element.on("click focus", function (e) {
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
            var destroyFn = scope.$on('$destroy', function () {
                if (ctrl.container) {
                    ctrl.container.remove();
                    ctrl.container = null;
                }

                destroyFn()
            });

            function _documentKeyDown(e) {
                // hide inactive instances
                datepickerLightService.hideIfInactive();
            }

            function _documentClick(e) {
                //prevent closing calender when month or year is selected
                var target = $(e.target);
                if(target.is('select') || target.hasClass('option') || target.parent().hasClass('option')) {
                    return;
                }

                // hide inactive dropdowns
                datepickerLightService.hideIfInactive();

                // we care about the active non-inline one only
                if (ctrl.instanceId !== ctrl.activeInstanceId() || ctrl.isInline()) {
                    return;
                }

                // no container. probably destroyed in scope $destroy
                if (!ctrl.container) {
                    return;
                }

                // hide the active calendar if user clicks anywhere away from the dropdown list
                var offset = ctrl.container[0].getBoundingClientRect();
                var isMouseAwayFromActiveContainer = false;
                var awayTolerance = ctrl.options.datepickerClickMargin;

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

                    //check if mouse is over the alt target (ex:image icon)
                    if (angular.isElement(ctrl.options.altTarget)) {
                        offset = ctrl.options.altTarget[0].getBoundingClientRect();
                        if (e.pageX >= offset.left
                            && e.pageX <= offset.left + offset.width
                            && e.pageY >= offset.top
                            && e.pageY <= offset.top + offset.height) {

                            isMouseAwayFromActiveContainer = false;
                        }
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
            minDate = null,
            maxDate = null,
            calendarItems = [];

        var monthNamesLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

        this.isUiSelectEnabled = function () {
            // options.useAngularUiSelect can be either true or false
            return that.options.useAngularUiSelect === true;
        }

        this.hideTodayDateEnabled = function () {
            // options.useAngularUiSelect can be either true or false
            return that.options.hideTodayDate === true;
        }

        this.init = function (options) {
            that.options = options;
            that.instanceId = ++instanceCount;

            var now = new Date();

            minDate = parseDate(that.options.minDate);
            maxDate = parseDate(that.options.maxDate);

            prevYers = that.options.prevYers;
            nextYears = that.options.nextYears;

            // set min and max date values
            // if not provided in options default minDate to 1/1/(-5 years) and maxDate to 12/31/(+5 years) of next year
            if (isUndefinedOrNull(minDate)) {
                minDate = new Date(now.getFullYear() - prevYers, 0, 1);
            }

            // maxdate
            if (isUndefinedOrNull(maxDate)) {
                maxDate = new Date(now.getFullYear() + nextYears, 11, 31);
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

            var defaultDate = getDefaultDate();

            that.selectedMonth = defaultDate.getMonth();
            that.selectedYear = defaultDate.getFullYear();
            that.selectedData = getCellData(defaultDate);

            buildCalendar();

            // build years array
            for (i = minDate.getFullYear() ; i <= maxDate.getFullYear() ; i++) {
                that.validYears.push(i);
            }
        }


        this.tryApplyDateFromTarget = function () {
            // textModelCtrl will be null if ng-model directive is not applied to the input element
            // or the target is a non-input div, span etc. in which case we get the element using jquery
            if (that.textModelCtrl === null) {
                that.targetText = jQueryTargetValue();
            }
            else {
                that.targetText = that.textModelCtrl.$viewValue;
            }

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

            // update the the target with the current selected date if the target text is not a valid date
            var targetValue = jQueryTargetValue();

            if (targetValue === null || targetValue.length === 0 || parseDate(targetValue) === null) {
                if (!isUndefinedOrNull(that.selectedData)) {
                    updateTargetModel(formatDate(that.selectedData.date));
                }
            }
            else {
                //updateTargetModel(formatDate(targetValue));
                that.tryApplyDateFromTarget();
            }

            that.show();
        }

        this.ready = function() {
            safeCallback(that.options.ready, methods);
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
            var css = {
            };

            var dateVisible = that.isDateVisible(cellData.date);

            css["date-visible"] = dateVisible;
            css["date-other-month"] = dateVisible && that.isOtherMonth(cellData.date);
            css["date-selected"] = dateVisible && that.isDateSelected(cellData.date);
            css["date-disabled"] = dateVisible && (cellData.enabled === false);

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

        this.toggleShow = function() {
            if(that.containerVisible){
                this.hide();
            }
            else{
                this.activate();
            }
        }


        this.show = function () {
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


        this.getDate = function() {
            if (!isUndefinedOrNull(that.selectedData) && angular.isObject(that.selectedData)) {
                return that.selectedData.date;
            }
        }

        this.setDate = function(dateToSelect) {
            if (isUndefinedOrNull(dateToSelect)) {
                return;
            }

            // is it a Date object?
            if (angular.isDate(dateToSelect) && isDateInRange(dateToSelect)) {
                that.dateSelect(getCellData(dateToSelect));
                return;
            }

            // parse string
            if (angular.isString(dateToSelect)) {
                var date = parseDate(dateToSelect);

                if (!isUndefinedOrNull(date) && isDateInRange(date)) {
                    that.dateSelect(getCellData(date));
                }
            }
        }


        function getDefaultDate() {
            var defaultDate;

            // if defaultDate is not provided default to today
            if (isUndefinedOrNull(that.options.defaultDate)) {
                return that.todayDate;
            }

            // is it a date instance?
            if (angular.isDate(that.options.defaultDate)) {
                defaultDate = that.options.defaultDate;
            }
            // try parsing the 'defaultDate' from options
            else {
                var date = parseDate(that.options.defaultDate);

                // if parsing failed set default to todayDate
                if (date === null) {
                    defaultDate = that.todayDate;
                }
                else {
                    defaultDate = date;
                }
            }

            // at this point defaultDate is either 'today' or 'options.defaultDate'
            // if defaultDate is outside valid date range default to todayDate
            if (!isDateInRange(defaultDate)) {
                defaultDate = that.todayDate;
            }

            return defaultDate;
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

            if (isMonthYearInRange(month, year)) {
                return {
                    month: month,
                    year: year
                };
            }

            return {
                month: monthCopy,
                year: yearCopy
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

            if (isMonthYearInRange(month, year)) {
                return {
                    month: month,
                    year: year
                };
            }

            return {
                month: monthCopy,
                year: yearCopy
            };
        }

        // returns true if the month and year are within min date and max date
        function isMonthYearInRange (month, year) {
            // adjust month to 1-based because format date returns month as 1-based
            var monthPlusOne = month + 1;
            var leadingZero = monthPlusOne < 10 ? "0" : "";

            if (parseInt(year + leadingZero + monthPlusOne) < parseInt(formatDate(minDate, 'YYYYMM'))
                || parseInt(year + leadingZero + monthPlusOne) > parseInt(formatDate(maxDate, 'YYYYMM'))) {

                return false;
            }

            return true;
        }

        // sets that.selectedMonth and that.selectedYear if different.
        // returns true if the properties were set
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
                var cbRetVal = safeCallback(that.options.renderDate, {
                    date: cellData.date
                });

                // pass an empty literal in case nothing was returned from callback
                copySupportedProperties(cbRetVal || {
                }, cellData);
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

            var cbRetVal = safeCallback(that.options.beforeDateSelect, {
                date: cellData.date,
                data: cellData.data
            });

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

            safeCallback(that.options.dateSelected, {
                date: cellData.date,
                data: cellData.data
            });
        }


        function parseDate(value) {

            var mom =  moment(value, that.options.dateFormat);

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

            //if min date is defined
            if( that.options.minDate ) {

                var momMinDate = moment(minDate);
                // and max date is also defined
                if( that.options.maxDate ){

                    var momMaxDate = moment(maxDate);

                    return momDate.isSameOrAfter(momMinDate, 'd')
                        && momDate.isSameOrBefore(momMaxDate, 'd');
                }
                return momDate.isSameOrAfter(momMinDate, 'd');
            }
            else if( that.options.maxDate ){ // if only max date is defined
                return momDate.isSameOrBefore(momMaxDate, 'd');
            }

            return true;
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

        function positionDatepicker() {
            if (that.isInline()) {
                return;
            }

            var rect = that.target[0].getBoundingClientRect();

            // use the .position() function from jquery.ui if available
            // requires both jquery and jquery-ui to be loaded
            if ($window.jQuery && $window.jQuery.ui) {
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
                var scrollTop = $document[0].body.scrollTop || $document[0].documentElement.scrollTop || $window.pageYOffset;
                var scrollLeft = $document[0].body.scrollLeft || $document[0].documentElement.scrollLeft || $window.pageXOffset;

                that.container.css({
                    "left": rect.left + scrollLeft + "px"
                });
                that.container.css({
                    "top": rect.top + rect.height + scrollTop + 3 + "px"
                });
            }
        }

        function updateTargetModel(modelValue) {
            // textModelCtrl will be null if ng-model directive
            // is not applied to the input element or may be the target is a non-input div, span etc.
            // in this scenario try updating using jquery
            if (that.textModelCtrl === null) {
                jQueryTargetValue(modelValue);
                return;
            }

            // update only if different from current value
            if (modelValue !== that.textModelCtrl.$modelValue) {
                that.textModelCtrl.$setViewValue(modelValue);
                that.textModelCtrl.$render();
            }
        }

        function jQueryTargetValue (value) {
            var targetTextFn;

            // ng-model is not applied or its not an input element
            // perhaps a <div>, <span> etc.
            if (that.target[0].tagName.toLowerCase() === 'input') {
                targetTextFn = that.target.val.bind(that.target);
            }
            else {
                targetTextFn = that.target.html.bind(that.target);
            }

            if (angular.isUndefined(value)) {
                return targetTextFn().trim();
            }
            else {
                targetTextFn(value);
            }
        }


        var methods = (function () {
            return {
                getMonthYear: function () {
                    // month starts at 0
                    return {
                        month: that.selectedMonth + 1,
                        year: that.selectedYear
                    };
                },

                gotoMonthYear: function (month, year) {
                    // month starts at 0
                    if (isMonthYearInRange(month - 1, year)) {
                        that.selectedMonth = month - 1;
                        that.selectedYear = year;

                        buildCalendar();
                    }
                },

                getDate: function () {
                    return that.getDate();
                },

                setDate: function (date) {
                    that.setDate(date);
                },

                refresh: function () {
                    buildCalendar();
                }
            }
        })();

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
        toggleTarget: null,
        inline: false,
        dateFormat: 'MM/DD/YYYY',
        defaultDate: null,
        minDate: null,
        maxDate: null,
        firstDayOfWeek: 0,
        showOtherMonthDates: false,
        containerCssClass: null,
        datepickerClickMargin: 100,
        ready: angular.noop,
        monthYearChanged: angular.noop,
        datepickerShown: angular.noop,
        datepickerHidden: angular.noop,
        renderDate: angular.noop,
        beforeDateSelect: angular.noop,
        dateSelected: angular.noop,
        useAngularUiSelect: false,
        hideTodayDate: false,
        prevYers: 5,
        nextYears: 5
    };

    var defaultOptionsDoc = {
        altTarget: {
            def: "null",
            doc: "Normally this is the calendar icon jQuery element associated with the datepicker."
        },
        toggleTarget: {
            def: "null",
            doc: "A JQuery selector, on click of which, calender will toggle display(show/hide)."
        },
        inline: {
            def: "false",
            doc: "If set to true displays the datepicker inline below the target. Alternatively, set to a jQuery element to append the datepicker."
        },
        inputDateFormat: {
            def: "MM/DD/YYYY",
            doc: "The date format used to parse input dates."
        },
        defaultDate: {
            def: "null",
            doc: "The default date to select when the datepicker is first shown. Set to an actual Date object or as a string in the current dateFormat."
        },
        minDate: {
            def: "null",
            doc: "The minimum selectable date. If set to null defaults to 01/01 and five years in the past."
        },
        maxDate: {
            def: "null",
            doc: "The maximum selectable date. If set to null defaults to 12/31 and five years in the future."
        },
        firstDayOfWeek: {
            def: "0",
            doc: "The first day of the week. 0 is Sunday, 1 is Monday and so forth."
        },
        showOtherMonthDates: {
            def: "false",
            doc: "Display dates from other months at the start or end of the current month."
        },
        containerCssClass: {
            def: "null",
            doc: "CSS class applied to the datepicker container"
        },
        datepickerClickMargin: {
             def: "100",
             doc: "Defines the margin in pixels around the datepicker when inline is set to false. Clicking outside this margin closes the datepicker."
        },
        ready: {
            def: "noop",
            doc: "Callback after the datepicker is initialized and ready. The function receives an object with the following methods:",
            docArray: [
                {"getMonthYear": "Returns an object with the selected month and year."},
                {"gotoMonthYear (month, year)": "Sets the selected month and year. The month and year must be within minDate and maxDate."},
                {"getDate": "Returns the selected date."},
                {"setDate (date)": "Sets the selected date in the datepicker. Set to an actual Date object or as a string in the current dateFormat. The date must be within minDate and maxDate."},
                {"refresh": "Rebuilds the datepicker."}
            ]
        },
        monthYearChanged: {
            def: "noop",
            doc: "Callback when either the selected month or year changes. The function receives an object with the selected 'month' and 'year' as properties."
        },
        datepickerShown: {
            def: "noop",
            doc: "Callback when the datepicker is shown."
        },
        datepickerHidden: {
            def: "noop",
            doc: "Callback when the datepicker is hidden."
        },
        renderDate: {
            def: "noop",
            doc: "Callback when the datepicker is being rendered. This is called for each date in the datepicker. The function receives an object with 'date' as parameter. Return an object with the following properties:",
            docArray: [
                {"cssClass": "The CSS class to apply to the date cell."},
                {"enabled": "Set to false to disable a date."},
                {"selected": "Set to true to select a date."},
                {"tooltip": "Tooltip for the date html table cell."},
                {"data": "Set to any arbitrary data on the date cell."}
            ]
        },
        beforeDateSelect: {
            def: "noop",
            doc: "Callback before a date is about to be selected. The function receives an object with 'date' and 'data' properties. To prevent selecting the date return an object with 'cancel' set to true."
        },
        dateSelected: {
            def: "noop",
            doc: "Callback after a date is selected. The function receives an object with 'date' and 'data' properties."
        },
        useAngularUiSelect: {
            def: "false",
            doc: "Specifies if ui-select should be used for drop-downs. Note that we assume if this is true, than ui-select is already included in project."
        },
        hideTodayDate: {
            def: "false",
            doc: "If true, hides bottom panel(containing today's date) from calender display."
        },
        prevYers: {
            def: "5",
            doc: "Sets number of previous years(from current year) to display in year drop-down. NOTE if minDate is defined, this will be ignored in minDate's favor."
        },
        nextYears: {
            def: "5",
            doc: "Sets number of next years(from current year) to display in year drop-down. NOTE if maxDate is defined, this will be ignored in maxDate's favor"
        }
    };


    var html_p1 = "";

    html_p1 += '<div class="datepicker-container" data-instance-id="{{ctrl.instanceId}}" ng-show="ctrl.containerVisible">';
    html_p1 += '<div class="top-panel">';
    html_p1 += '    <table class="calendar" border="0" cellpadding="0" cellspacing="0">';
    html_p1 += '        <tbody>';
    html_p1 += '            <tr>';

    html_ui_select = "";
    html_ui_select += '                <td style="text-align:left; display: flex;">';
    html_ui_select += '                    <ui-select class="ui-select-month" ng-model="ctrl.selectedMonth" ng-change="ctrl.monthChange(ctrl.selectedMonth)" search-enabled="false" theme="selectize" ng-required>';
    html_ui_select += '                          <ui-select-match> {{$select.selected.name}} </ui-select-match>';
    html_ui_select += '                          <ui-select-choices repeat="item.index as item in ctrl.monthNames">';
    html_ui_select += '                               <span ng-bind-html="item.name"></span>';
    html_ui_select += '                          </ui-select-choices>';
    html_ui_select += '                     </ui-select>';
    html_ui_select += '                    <ui-select class="ui-select-year" ng-model="ctrl.selectedYear" ng-change="ctrl.yearChange(ctrl.selectedYear)" search-enabled="false" theme="selectize" ng-required>';
    html_ui_select += '                          <ui-select-match> {{$select.selected}} </ui-select-match>';
    html_ui_select += '                          <ui-select-choices repeat="item in ctrl.validYears">';
    html_ui_select += '                               <span ng-bind-html="item"></span>';
    html_ui_select += '                          </ui-select-choices>';
    html_ui_select += '                     </ui-select>';


    html_default_select = "";
    html_default_select += '                <td style="text-align:left">';
    html_default_select += '                    <select class="months" ';
    html_default_select += '                            ng-change="ctrl.monthChange(ctrl.selectedMonth)"';
    html_default_select += '                            ng-model="ctrl.selectedMonth"';
    html_default_select += '                            ng-options="item.index as item.name for item in ctrl.monthNames">';
    html_default_select += '                    </select>';
    html_default_select += '                    <select class="years" ';
    html_default_select += '                            ng-model="ctrl.selectedYear"';
    html_default_select += '                            ng-change="ctrl.yearChange(ctrl.selectedYear)"';
    html_default_select += '                            ng-options="item for item in ctrl.validYears"></select>';

    html_p2 = "";
    html_p2 += '                </td>';
    html_p2 += '                <td style="text-align:right">';
    html_p2 += '                    <div>';
    html_p2 += '                        <a class="prev" ';
    html_p2 += '                           ng-click="ctrl.gotoPreviousMonth(ctrl.selectedMonth, ctrl.selectedYear)"';
    html_p2 += '                           href="javascript:void(0)" ';
    html_p2 += '                           title="Previous Month"></a>';
    html_p2 += '                        <a class="next" ';
    html_p2 += '                           ng-click="ctrl.gotoNextMonth(ctrl.selectedMonth, ctrl.selectedYear)"';
    html_p2 += '                           href="javascript:void(0)"' ;
    html_p2 += '                           title="Next Month"></a>';
    html_p2 += '                    </div>';
    html_p2 += '                </td>';
    html_p2 += '            </tr>';
    html_p2 += '        </tbody>';
    html_p2 += '    </table>';
    html_p2 += '</div>';
    html_p2 += '<div class="middle-panel">';
    html_p2 += '    <table class="calendar" border="0" cellpadding="0" cellspacing="0">';
    html_p2 += '        <thead>';
    html_p2 += '            <tr>';
    html_p2 += '                <th ng-repeat="day in ctrl.dayNames" style="width:14%">';
    html_p2 += '                    {{day}}';
    html_p2 += '                </th>';
    html_p2 += '            </tr>';
    html_p2 += '        </thead>';
    html_p2 += '        <tbody>';
    html_p2 += '            <tr>';
    html_p2 += '                <td colspan="7">';
    html_p2 += '                    &nbsp;';
    html_p2 += '                </td>';
    html_p2 += '            </tr>';
    html_p2 += '            <tr class="week-row" ng-repeat="week in ctrl.weeks">';
    html_p2 += '                <td ng-class="ctrl.dateCellCssClass(item)"';
    html_p2 += '                    ng-click="ctrl.dateSelect(item)"';
    html_p2 += '                    ng-repeat="item in week"';
    html_p2 += '                    title="{{item.tooltip}}">';
    html_p2 += '                    <span ng-if="ctrl.isDateVisible(item.date)">{{ctrl.dateDisplay(item)}}</span>';
    html_p2 += '                </td>';
    html_p2 += '            </tr>';
    html_p2 += '            <tr class="week-row-placeholder" ng-if="ctrl.weeks.length < 6">';
    html_p2 += '                <td ng-repeat="n in [7]">&nbsp;</td>';
    html_p2 += '            </tr>';
    html_p2 += '        </tbody>';
    html_p2 += '    </table>';
    html_p2 += '</div>';
    html_p2 += '<div class="bottom-panel">';
    html_p2 += '    <table class="calendar" ng-click="ctrl.todayDateSelect()" border="0" cellpadding="0" cellspacing="0">';
    html_p2 += '        <tbody>';
    html_p2 += '            <tr class="today">';
    html_p2 += '                <td style="text-align:left">';
    html_p2 += '                    <a class="today" ';
    html_p2 += '                       href="javascript:void(0)">Today {{ctrl.todayDateDisplay}}</a>';
    html_p2 += '                </td>';
    html_p2 += '                <td>&nbsp;</td>';
    html_p2 += '            </tr>';
    html_p2 += '        </tbody>';
    html_p2 += '    </table>';
    html_p2 += '</div>';
    html_p2 += '</div>';

    var html = html_p1+html_default_select+html_p2;
    var html_uiselect = html_p1+html_ui_select+html_p2;

}));

