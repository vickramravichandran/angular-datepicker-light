(function () {
    'use strict';

    angular
        .module('mainApp', ['datepickerLightModule'])
        .controller('OnFocusCtrl', OnFocusCtrl)
        .controller('InlineCtrl', InlineCtrl)
        .controller('InlineOtherMonthDatesCtrl', InlineOtherMonthDatesCtrl)
        .controller('InlineDisabledDatesCtrl', InlineDisabledDatesCtrl)
        .controller('InlineCustomWeekStartCtrl', InlineCustomWeekStartCtrl)
        .controller('InlineDivTargetCtrl', InlineDivTargetCtrl);

    var today = new Date();
    var mom = moment(today);
    var dateText = mom.format("MM/DD/YYYY");

    // on focus
    function OnFocusCtrl() {
        var vm = this;
        vm.date = dateText;
    }

    // inline
    function InlineCtrl() {
        var vm = this;

        vm.date = dateText;
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, other month dates
    function InlineOtherMonthDatesCtrl() {
        var vm = this;

        vm.date = dateText;

        vm.datepickerOptions = {
            inline: true,
            showOtherMonthDates: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, week starts on Monday
    function InlineCustomWeekStartCtrl() {
        var vm = this;

        vm.date = dateText;

        vm.datepickerOptions = {
            inline: true,
            firstDayOfWeek: 1,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, disabled dates, tooltip
    function InlineDisabledDatesCtrl() {
        var vm = this;

        vm.date = dateText;

        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            renderDate: function (e) {
                var date = e.date.getDate();

                var enable = (date < 20 || date > 29);
                return {
                    enabled: enable,
                    tooltip: enable ? null : "We are closed!"
                }
            }
        };
    }

    function InlineDivTargetCtrl() {
        var vm = this;

        vm.date = today;

        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            dateSelected: function (e) {
                vm.date = e.date;
            }
        };
    }
})();
