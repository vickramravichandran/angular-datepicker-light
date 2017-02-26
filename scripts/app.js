(function () {
    'use strict';

    angular
        .module('mainApp', ['datepickerLightModule'])
        .controller('OnFocusCtrl', OnFocusCtrl)
        .controller('InlineCtrl', InlineCtrl)
        .controller('InlineDisabledDatesCtrl', InlineDisabledDatesCtrl)
        .controller('InlineOtherMonthDatesCtrl', InlineOtherMonthDatesCtrl)
        .controller('InlineCustomWeekStartCtrl', InlineCustomWeekStartCtrl)
        .controller('InlineDivTargetCtrl', InlineDivTargetCtrl)
        .controller('PositionUsingJQueryCtrl', PositionUsingJQueryCtrl);

    // on focus
    function OnFocusCtrl() {
        var vm = this;
        vm.date = "07/01/2016";
        vm.datepickerOptions = {
            altTarget: $("#calendarIcon")
        };
    }

    // inline
    function InlineCtrl() {
        var vm = this;

        vm.date = "07/01/2016";
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, disabled dates, tooltip
    function InlineDisabledDatesCtrl() {
        var vm = this;

        vm.date = "07/01/2016";
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            renderDate: function (e) {
                var date = e.date.getDate();

                var enable = (date < 5 || date > 20);
                return {
                    enabled: enable,
                    tooltip: enable ? null : "We are closed!"
                }
            },
            beforeDateSelect: function (e) {
                var date = e.date.getDate();
                return { cancel: date === 30 };
            }
        };
    }

    // inline, other month dates
    function InlineOtherMonthDatesCtrl() {
        var vm = this;

        vm.date = "07/01/2016";
        vm.datepickerOptions = {
            inline: true,
            showOtherMonthDates: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, week starts on Monday
    function InlineCustomWeekStartCtrl() {
        var vm = this;

        vm.date = "07/01/2016";
        vm.datepickerOptions = {
            inline: true,
            firstDayOfWeek: 3,
            containerCssClass: "datepicker-container-inline"
        };
    }

    function InlineDivTargetCtrl() {
        var vm = this;

        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            dateFormat: 'MMM Do YYYY'
        };
    }

    function PositionUsingJQueryCtrl() {
        var vm = this;
        vm.hasjQuery = (window.jQuery && window.jQuery.ui);
        vm.date = "07/01/2016";
        vm.datepickerOptions = {
            positionUsingJQuery: true,
            altTarget: $("#calendarIcon-2")
        };
    }

})();
