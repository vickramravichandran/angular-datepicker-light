(function () {
    'use strict';

    angular
        .module('mainApp', ['datePickerModule'])
        .controller('OnFocusController', OnFocusController)
        .controller('InlineController', InlineController)
        .controller('InlineOtherMonthDatesController', InlineOtherMonthDatesController)
        .controller('InlineDisabledDatesController', InlineDisabledDatesController)
    ;

    // on focus
    function OnFocusController() {
        var vm = this;
        vm.date = "03/25/2016";
    }

    // inline
    function InlineController() {
        var vm = this;

        vm.date = "07/04/2016";
        vm.datePickerOptions = {
            inline: true,
            containerCssClass: "date-picker-container-inline"
        };
    }

    // inline, other month dates
    function InlineOtherMonthDatesController() {
        var vm = this;

        vm.date = "07/21/2016";

        vm.datePickerOptions = {
            inline: true,
            showOtherMonthDates: true,
            containerCssClass: "date-picker-container-inline"
        };
    }

    // inline, disabled dates, tooltip
    function InlineDisabledDatesController() {
        var vm = this;

        vm.date = "07/01/2016";

        vm.datePickerOptions = {
            inline: true,
            containerCssClass: "date-picker-container-inline",
            //datePickerParent: $("#datePickerParent3"),
            renderDate: function (cellData) {
                var date = cellData.date.getDate();

                // enable custom dates
                var enabled = (date < 20 || date > 29);

                cellData.enabled = enabled;
                cellData.tooltip = enabled ? "Working Day" : "Holiday";
            }
        };
    }


})();
