(function () {
    'use strict';

    angular
        .module('mainApp', ['datepickerLightModule', 'ngSanitize'])
        .controller('OnFocusCtrl', OnFocusCtrl)
        .controller('InlineCtrl', InlineCtrl)
        .controller('InlineDisabledDatesCtrl', InlineDisabledDatesCtrl)
        .controller('InlineOtherMonthDatesCtrl', InlineOtherMonthDatesCtrl)
        .controller('InlineCustomWeekStartCtrl', InlineCustomWeekStartCtrl)
        .controller('InlineDivTargetCtrl', InlineDivTargetCtrl)
        .controller('PluginOptionsCtrl', PluginOptionsCtrl);

    //var dateText = moment(new Date()).format("MM/DD/YYYY");

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

        vm.date = "07/20/2016";
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            renderDate: function (e) {
                return {
                    enabled: e.date.getDate() > 10
                }
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
            firstDayOfWeek: 1,
            containerCssClass: "datepicker-container-inline"
        };
    }

    function InlineDivTargetCtrl() {
        var vm = this;

        vm.date = "07/04/2016";
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    PluginOptionsCtrl.$inject = ["datepickerLightService"];
    function PluginOptionsCtrl(datepickerLightService) {
        this.options = datepickerLightService.defaultOptionsDoc();
    }
})();
