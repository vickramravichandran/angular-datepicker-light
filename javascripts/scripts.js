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

    var today = new Date();
    var mom = moment(today);
    var dateText = mom.format("MM/DD/YYYY");

    // on focus
    function OnFocusCtrl() {
        var vm = this;
        vm.date = dateText;
        vm.datepickerOptions = {
            altTarget: $("#calendarIcon")
        };
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
    
    // inline, disabled dates, tooltip
    function InlineDisabledDatesCtrl() {
        var vm = this;

        vm.date = dateText;

        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            renderDate: function (e) {
                var date = e.date.getDate();

                var enable = (date < 5 || date > 15);
                return {
                    enabled: enable,
                    tooltip: enable ? null : "We are closed!"
                }
            }
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

    PluginOptionsCtrl.$inject = ["datepickerLightService"];
    function PluginOptionsCtrl(datepickerLightService) {
        this.options = datepickerLightService.defaultOptionsDoc();
    }
})();
