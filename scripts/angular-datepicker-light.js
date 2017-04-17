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
    var activeInstanceId = 0;

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

    datepickerLightDirective.$inject = ['$compile', '$document', '$window', '$timeout', '$templateRequest', 'datepickerLightService'];
    function datepickerLightDirective($compile, $document, $window, $timeout, $templateRequest, datepickerLightService) {

        return {
            restrict: 'A',
            scope: {
                options: '&angularDatepickerLight'
            },
            transclude: false,
            controllerAs: 'ctrl',
            bindToController: true,
            require: ['angularDatepickerLight', '?ngModel'],
            link: postLinkFn,
            controller: MainCtrl
        }

        function postLinkFn(scope, element, attrs, ctrls) {
            var ctrl = ctrls[0]; //directive controller
            ctrl.textModelCtrl = ctrls[1]; // textbox model controller

            datepickerLightService.addDirectiveCtrl(ctrl);

            // store the jquery element on the controller          
            ctrl.target = element;

            // wait for page load before initialization to avoid any missing selectors
            $timeout(function(){
                // execute the options expression
                var options = ctrl.options() || {};
                ctrl.init(angular.extend({}, defaultOptions, options));
                
                initContainer(html);
                wireupEvents();
            });
            
            function initContainer(template) {
                var templateFn = $compile(template);
                ctrl.container = templateFn(scope);

                if (ctrl.options.containerCssClass) {
                    ctrl.container.addClass(ctrl.options.containerCssClass);
                }

                appendContainerToDOM(ctrl);

                // if a jquery altTarget is specified in options append the container
                // altTarget supported only for non-inline
                if (!ctrl.isInline() && angular.isElement(ctrl.options.altTarget)) {
                    // focus the textbox when the alt target(ex: image icon) is clicked
                    ctrl.options.altTarget.on('click focus', function (event) {
                        scope.$evalAsync(function () {
                            ctrl.activate();
                        });
                    });
                }
            }

            function appendContainerToDOM(ctrl) {
                // if inline is true append container after the textbox
                if (ctrl.options.inline === true) {
                    ctrl.target.after(ctrl.container);
                    return;
                }

                // if a jquery element is specified in options append the container to it
                if (angular.isElement(ctrl.options.inline)) {
                    ctrl.options.inline.append(ctrl.container);
                    return;
                }
                
                // container will be positioned absolutely
                ctrl.container.addClass('datepicker-absolute-container');
                if (ctrl.options.appendToBody) {
                    $document.find('body').append(ctrl.container);
                    return;
                }
                
                ctrl.target.after(ctrl.container);
            }

            function wireupEvents() {
            
                $document.ready(function(){
                    // activate all inline date pickers and call ready callback
                    scope.$evalAsync(function () {
                        if (ctrl.isInline()) {
                            ctrl.activate();
                        }
                        
                        ctrl.ready();
                    });
                });

                // when the target(textbox) gets focus activate the corresponding container
                element.on('click focus', function (event) {
                    scope.$evalAsync(function () {
                        ctrl.activate();
                    });
                });

                // when the target(textbox) changes
                element.on('keydown', function (event) {
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

                angular.element($window).on('resize', function (event) {
                    scope.$evalAsync(function () {
                        ctrl.hide();
                    });
                });

                // hide container upon CLICK outside of the dropdown rectangle region
                $document.on('click', function (event) {
                    scope.$evalAsync(function () {
                        _documentClick(event);
                    });
                });

                function _documentClick(event) {
                    // hide inactive dropdowns
                    datepickerLightService.hideIfInactive();

                    // ignore inline
                    if (ctrl.isInline()) {
                        return;
                    }

                    // no container. probably destroyed in scope $destroy 
                    if (!ctrl.container) {
                        return;
                    }

                    // ignore target click
                    if (event.target === ctrl.target[0]) {
                        return;
                    }

                    // ignore clicks on altTarget
                    if (ctrl.options.altTarget && event.target === ctrl.options.altTarget[0]) {
                        return;
                    }

                    if(ctrl.container.has(event.target).length > 0) {
                        return;
                    }

                    ctrl.hide();
                }
            }

            // cleanup on destroy
            var destroyFn = scope.$on('$destroy', function () {
                if (ctrl.container) {
                    ctrl.container.remove();
                    ctrl.container = null; 
                }

                destroyFn()
            });

        }
    }

    MainCtrl.$inject = ['$window', '$document', '$timeout', 'datepickerLightService'];
    function MainCtrl($window, $document, $timeout, datepickerLightService) {
        var that = this;

        var minDate = null,
            maxDate = null,
            calendarItems = [];

        var monthNamesLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        //var monthNamesShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

            minDate = parseDate(that.options.minDate);
            maxDate = parseDate(that.options.maxDate);
            
            // set min and max date values
            // if not provided in options default minDate to 1/1/(-5 years) and maxDate to 12/31/(+5 years) of next year
            if (!minDate) {
                minDate = new Date(now.getFullYear() - 5, 0, 1);
            }

            // maxdate
            if (!maxDate) {
                maxDate = new Date(now.getFullYear() + 5, 11, 31);
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

            that.showTodayDate = that.options.showTodayDate;
            that.todayDateDisplay = formatDate(now, that.options.todayDateFormat);

            var defaultDate = getDefaultDate();
            
            that.selectedMonth = defaultDate.getMonth();
            that.selectedYear = defaultDate.getFullYear();
            that.selectedData = createCellData(defaultDate);
            
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

            // if date is valid and in range, build calendar if month or year changed
            var date = parseDate(that.targetText);
            if(!date || !isDateInRange(date)) {
                return;
            }

            // date is valid and in range.
            // set that.selectedMonth and that.selectedYear if different
            var updated = setMonthYear(date);
            // build calendar only if month or year changed
            if (updated) {
                buildCalendar();
            }

            applySelection(date, true);
        }
        
        this.activate = function () {
            activeInstanceId = that.instanceId;
            
            // update target with the current selected date if the target text is not a valid date
            var targetValue = jQueryTargetValue();
            var date = parseDate(targetValue);
            var targetIsEmpty = (targetValue === null || targetValue.length === 0);
            var targetIsInvalid = !date || !isDateInRange(date);
            
            if ((targetIsEmpty && that.options.setTargetIfEmpty) ||
                (targetIsInvalid && that.options.setTargetIfInvalid))
            {
                if (that.selectedData) {
                    updateTargetModel(formatDate(that.selectedData.date));
                }
            }
            else {
                that.tryApplyDateFromTarget();
            }

            // if inline set container visibility only once
            if (that.isInline()) {
                if (!that.containerVisible) {
                    that.containerVisible = true;
                }
                return;
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

            css['date-visible'] = dateVisible;
            css['date-other-month'] = dateVisible && that.isOtherMonth(cellData.date);
            css['date-selected'] = dateVisible && that.isDateSelected(cellData.date);
            css['date-disabled'] = dateVisible && !cellData.enabled;

            // custom css class added in callback
            if (cellData.cssClass) {
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
            if (updated) {
                buildCalendar();
            }

            applySelection(cellData.date, false);

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
            if (updated) {
                buildCalendar();
            }

            applySelection(that.todayDate, false);

            that.hide();
        }


        this.show = function () {
            positionDatepicker();

            // callback
            safeCallback(that.options.datepickerShown);
        }

        this.hide = function () {
            // do not hide if displayed inline
            if (that.isInline()) {
                return;
            }

            // exit if already hidden
            if (!that.containerVisible) {
                return;
            }

            that.containerVisible = false;

            // callback
            safeCallback(that.options.datepickerHidden);
        }


        this.isDateVisible = function (date) {
            // if date is from previous/next month show/hide as set in options
            if (date.getMonth() !== that.selectedMonth) {
                if (that.options.showOtherMonthDates) {
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
            if (that.selectedData && that.selectedData.date) {
                return areDatesEqual(date, that.selectedData.date);
            }

            return false;
        }

        this.isDateEnabled = function (date) {
            var cellData = calendarItems.find(function (cellData) {
                return areDatesEqual(cellData.date, date);
            });

            // object exists?
            if (cellData) {
                return cellData.enabled;
            }

            // cell data with given date not found
            return false;
        }

        
        this.getDate = function() {
            if (that.selectedData && that.selectedData.date) {
                return that.selectedData.date;
            }
        }
        
        this.setDate = function(dateToSelect) {
            if (!dateToSelect) {
                return;
            }
            
            // is it a Date object?
            if (angular.isDate(dateToSelect) && isDateInRange(dateToSelect)) {
                that.dateSelect(createCellData(dateToSelect));
                return;
            }
            
            // parse string
            if (!angular.isString(dateToSelect)) {
                return;
            }

            var date = parseDate(dateToSelect);
            if (date && isDateInRange(date)) {
                that.dateSelect(createCellData(date));
            }
        }
        

        function getDefaultDate() {
            var defaultDate = that.options.defaultDate;
            
            // if defaultDate is not provided default to today
            if (!defaultDate) {
                return that.todayDate;
            }
            
            // is it a date instance and within range?
            if (angular.isDate(defaultDate) && isDateInRange(defaultDate)) {
                return defaultDate;
            }
            
            // is it a string?
            if (!angular.isString(defaultDate)) {
                return that.todayDate;
            }

            // try parsing the 'defaultDate' from options
            var date = parseDate(defaultDate);
            if (date && isDateInRange(date)) {
                return date;
            }

            return that.todayDate;
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
            var leadingZero = monthPlusOne < 10 ? '0' : '';
            
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
                if (daysBefore) {
                    // 0 is one day prior; 1 is two days prior and so forth
                    date = date - daysBefore;
                }
            }

            while (date <= getDaysInMonth(year, month)) {
                calendarItems.push(createCellData(getDate(year, month, date++)));
            }

            // fill remaining cells with dates from next month
            while ((calendarItems.length % 7) !== 0) {
                calendarItems.push(createCellData(getDate(year, month, date++)));
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
                copySupportedProperties((cbRetVal || {}), cellData);
            });
        }

        function copySupportedProperties(cbRetVal, cellData) {
            // if cbRetVal.enabled is undefined default to true
            cellData.enabled = isUndefinedOrNull(cbRetVal.enabled) ? true : cbRetVal.enabled;

            // is cbRetVal.selected is explicitly set to true?
            cellData.selected = (cbRetVal.selected === true && cellData.enabled);
            
            // css class to apply to the date <td>
            cellData.cssClass = cbRetVal.cssClass

            // arbitrary custom data to store with date
            cellData.data = cbRetVal.data;

            // tooltip for the date <td>
            cellData.tooltip = cbRetVal.tooltip;
        }

        function getCellDataBySelectedState() {
            // find the calendar item with selected = true.
            // this might have been set during during the render callback
            return calendarItems.find(function (cellData) {
                // must be enabled to be able to select
                return cellData.selected && cellData.enabled;
            });
        }

        function getCellDataByDate(dateToSelect) {
            if (!angular.isDate(dateToSelect)) {
                return;
            }
            
            // find the cell data that is enabled and not already selected
            return calendarItems.find(function (cellData) {
                return areDatesEqual(cellData.date, dateToSelect);
            });
        }


        function getDate(year, month, day) {
            return new Date(year, month, day);
        }

        function getDaysInMonth(year, month) {
            return moment().year(year).month(month).daysInMonth();
        }

        function createCellData(date) {
            return {
                date: date,
                enabled: true,
                selected: false,
                tooltip: angular.undefined,
                cssClass: angular.undefined,
                data: angular.undefined,
            }
        }


        function applySelection(dateToSelect, updatingFromTarget) {
            // give priority to the cellData.selected property
            // the cellData.selected property can be set by the user during the renderDate callback
            var cellData = getCellDataBySelectedState();

            // if no cell has selected property set, select the cell by date
            if (!cellData) {
                cellData = getCellDataByDate(dateToSelect);

                if (!cellData || !cellData.enabled) {
                    return;
                }
            }

            var cbRetVal = safeCallback(that.options.beforeDateSelect, {
                date: cellData.date,
                data: cellData.data
            });

            // cancel selection if explicitly set to true from callback
            if (cbRetVal && cbRetVal.cancel === true) {
                return;
            }

            that.selectedMonth = cellData.date.getMonth();
            that.selectedYear = cellData.date.getFullYear();
            that.selectedData = cellData;

            if (!updatingFromTarget) {
                updateTargetModel(formatDate(that.selectedData.date));
            }

            safeCallback(that.options.dateSelected, {
                date: cellData.date,
                data: cellData.data
            });
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

        function positionDatepicker() {
            if (that.options.positionUsingJQuery) {
                positionUsingJQuery();
                return;
            }

            var rect = that.target[0].getBoundingClientRect();
            var scrollLeft = $document[0].body.scrollLeft || $document[0].documentElement.scrollLeft || $window.pageXOffset;
            var scrollTop = $document[0].body.scrollTop || $document[0].documentElement.scrollTop || $window.pageYOffset;
            
            that.container.css({
                'left': rect.left + scrollLeft + 'px'
            });
            that.container.css({
                'top': rect.top + rect.height + scrollTop + 3 + 'px'
            });
            
            that.containerVisible = true;
        }

        function positionUsingJQuery() {
            // use the .position() function from jquery.ui if available
            // requires both jquery and jquery-ui
            if (!$window.jQuery || !$window.jQuery.ui) {
                throw 'jQuery or jQuery.ui were not found.';
            }

            var pos = {
                my: 'left top',
                at: 'left bottom',
                of: that.target,
                collision: 'none flip'
            };

            if (that.options.positionUsing) {
                pos = that.options.positionUsing;
            }

            that.containerVisible = true;
            that.container.position(pos);
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
            
            // getter
            if (!value) {
                return targetTextFn().trim();
            }

            // setter
            targetTextFn(value);
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
        inline: false,
        appendToBody: true,
        dateFormat: 'MM/DD/YYYY',
        todayDateFormat: 'ddd MMM DD YYYY',
        showTodayDate: true,
        defaultDate: null,
        minDate: null,
        maxDate: null,
        firstDayOfWeek: 0,
        showOtherMonthDates: false,
        setTargetIfEmpty: true,
        setTargetIfInvalid: true,
        containerCssClass: null,
        /*position using jQuery*/
        positionUsingJQuery: false,
        positionUsing: null,
        /*callbacks*/
        ready: angular.noop,
        monthYearChanged: angular.noop,
        datepickerShown: angular.noop,
        datepickerHidden: angular.noop,
        renderDate: angular.noop,
        beforeDateSelect: angular.noop,
        dateSelected: angular.noop
    };

    var defaultOptionsDoc = {
        altTarget: {
            def: 'null',
            doc: 'Normally this is the calendar icon jQuery element associated with the datepicker.'
        },
        inline: {
            def: 'false',
            doc: 'If set to true displays the datepicker inline below the target. If set to false appends the datepicker to the body. Alternatively, set to a jQuery element to append the datepicker to.'
        },
        appendToBody: {
            def: 'true',
            doc: 'If set to true appends the datepicker to the body. If set to false, appends the datepicker after the target element. This setting has no effect if inline is set to true.'
        },
        dateFormat: {
            def: 'MM/DD/YYYY',
            doc: 'The date format used to parse and display dates. For a full list of the possible formats see the <a href="http://momentjs.com/docs/#/displaying/format/">momentjs documentation<a>'
        },
        todayDateFormat: {
            def: 'ddd MMM DD YYYY',
            doc: 'The date format used to display today date. For a full list of the possible formats see the <a href="http://momentjs.com/docs/#/displaying/format/">momentjs documentation<a>'
        },
        showTodayDate: {
            def: 'true',
            doc: 'Display today date at the bottom of the datepicker.'
        },
        defaultDate: {
            def: 'null',
            doc: 'The default date to select when the datepicker is first shown. Set to an actual Date object or as a string in the current dateFormat.'
        },
        minDate: {
            def: 'null',
            doc: 'The minimum selectable date. If set to null defaults to 01/01 and five years in the past.'
        },
        maxDate: {
            def: 'null',
            doc: 'The maximum selectable date. If set to null defaults to 12/31 and five years in the future.'
        },
        firstDayOfWeek: {
            def: '0',
            doc: 'The first day of the week. 0 is Sunday, 1 is Monday and so forth.'
        },
        showOtherMonthDates: {
            def: 'false',
            doc: 'Display dates from other months at the start or end of the current month.'
        },
        setTargetIfEmpty: {
            def: 'true',
            doc: 'Updates the target with the selected date, if target is empty, when the datepicker is activated.'
        },
        setTargetIfInvalid: {
            def: 'true',
            doc: 'Updates the target with the selected date, if the target date is invalid, when the datepicker is activated.'
        },
        containerCssClass: {
            def: 'null',
            doc: 'CSS class applied to the datepicker container'
        },
        positionUsingJQuery: {
            def: 'false',
            doc: 'If true will position the datepicker container using the position() method from the jQueryUI library. See <a href="https://api.jqueryui.com/position/">jQueryUI.position() documentation</a>'
        },
        positionUsing: {
            def: 'null',
            doc: 'Options that will be passed to jQueryUI position() method.'
        },
        ready: {
            def: 'noop',
            doc: 'Callback after the datepicker is initialized and ready. The function receives an object with the following methods:',
            docArray: [    
                {'getMonthYear': 'Returns an object with the selected month and year.'},
                {'gotoMonthYear (month, year)': 'Sets the selected month and year. The month and year must be within minDate and maxDate.'},
                {'getDate': 'Returns the selected date.'},
                {'setDate (date)': 'Sets the selected date in the datepicker. Set to an actual Date object or as a string in the current dateFormat. The date must be within minDate and maxDate.'},
                {'refresh': 'Rebuilds the datepicker.'}
            ]
        },
        monthYearChanged: {
            def: 'noop',
            doc: 'Callback when either the selected month or year changes. The function receives an object with the selected "month" and "year" as properties.'
        },
        datepickerShown: {
            def: 'noop',
            doc: 'Callback when the datepicker is shown.'
        },
        datepickerHidden: {
            def: 'noop',
            doc: 'Callback when the datepicker is hidden.'
        },
        renderDate: {
            def: 'noop',
            doc: 'Callback when the datepicker is being rendered. This is called for each date in the datepicker. The function receives an object with "date" as parameter. Return an object with the following properties:',
            docArray: [ 
                {'cssClass': 'The CSS class to apply to the date cell.'},
                {'enabled': 'Set to false to disable a date.'},
                {'selected': 'Set to true to select a date.'},
                {'tooltip': 'Tooltip for the date html table cell.'},
                {'data': 'Set to any arbitrary data on the date cell.'}
            ]
        },
        beforeDateSelect: {
            def: 'noop',
            doc: 'Callback before a date is about to be selected. The function receives an object with "date" and "data" properties. To prevent selecting the date return an object with "cancel" set to true.'
        },
        dateSelected: {
            def: 'noop',
            doc: 'Callback after a date is selected. The function receives an object with "date" and "data" properties.'
        }
    };

    
    var html = '';
    
    html += '<div class="datepicker-container" data-instance-id="{{ctrl.instanceId}}" ng-show="ctrl.containerVisible">';
    html += '<div class="top-panel">';
    html += '    <table class="calendar" border="0" cellpadding="0" cellspacing="0">';
    html += '        <tbody>';
    html += '            <tr>';
    html += '                <td style="text-align:left;">';
    html += '                    <select class="months" ';
    html += '                            ng-change="ctrl.monthChange(ctrl.selectedMonth)"';
    html += '                            ng-model="ctrl.selectedMonth"';
    html += '                            ng-options="item.index as item.name for item in ctrl.monthNames">';
    html += '                    </select>';
    html += '                    <select class="years" ';
    html += '                            ng-model="ctrl.selectedYear"';
    html += '                            ng-change="ctrl.yearChange(ctrl.selectedYear)"';
    html += '                            ng-options="item for item in ctrl.validYears"></select>';
    html += '                </td>';
    html += '                <td style="text-align:right">';
    html += '                    <div>';
    html += '                        <a class="prev" ';
    html += '                           ng-click="ctrl.gotoPreviousMonth(ctrl.selectedMonth, ctrl.selectedYear)"';
    html += '                           href="javascript:void(0)" ';
    html += '                           title="Previous Month"></a>';
    html += '                        <a class="next" ';
    html += '                           ng-click="ctrl.gotoNextMonth(ctrl.selectedMonth, ctrl.selectedYear)"';
    html += '                           href="javascript:void(0)"' ;
    html += '                           title="Next Month"></a>';
    html += '                    </div>';
    html += '                </td>';
    html += '            </tr>';
    html += '        </tbody>';
    html += '    </table>';
    html += '</div>';
    html += '<div class="middle-panel">';
    html += '    <table class="calendar" border="0" cellpadding="0" cellspacing="0">';
    html += '        <thead>';
    html += '            <tr>';
    html += '                <th ng-repeat="day in ctrl.dayNames" style="width:14%">';
    html += '                    {{day}}';
    html += '                </th>';
    html += '            </tr>';
    html += '        </thead>';
    html += '        <tbody>';
    html += '            <tr>';
    html += '                <td colspan="7">';
    html += '                    &nbsp;';
    html += '                </td>';
    html += '            </tr>';
    html += '            <tr class="week-row" ng-repeat="week in ctrl.weeks">';
    html += '                <td ng-class="ctrl.dateCellCssClass(item)"';
    html += '                    ng-click="ctrl.dateSelect(item)"';
    html += '                    ng-repeat="item in week"';
    html += '                    title="{{item.tooltip}}">';
    html += '                    <span ng-if="ctrl.isDateVisible(item.date)">{{ctrl.dateDisplay(item)}}</span>';
    html += '                </td>';
    html += '            </tr>';
    html += '            <tr class="week-row-placeholder" ng-if="ctrl.weeks.length < 6">';
    html += '                <td ng-repeat="n in [7]">&nbsp;</td>';
    html += '            </tr>';
    html += '        </tbody>';
    html += '    </table>';
    html += '</div>';
    html += '<div class="bottom-panel" ng-show="ctrl.showTodayDate">';
    html += '    <table class="calendar" border="0" cellpadding="0" cellspacing="0">';
    html += '        <tbody>';
    html += '            <tr class="today">';
    html += '                <td style="text-align:left">';
    html += '                    <a class="today" ';
    html += '                       ng-click="ctrl.todayDateSelect()"';
    html += '                       href="javascript:void(0)">Today {{ctrl.todayDateDisplay}}</a>';
    html += '                </td>';
    html += '                <td>&nbsp;</td>';
    html += '            </tr>';
    html += '        </tbody>';
    html += '    </table>';
    html += '</div>';
    html += '</div>';

}));
